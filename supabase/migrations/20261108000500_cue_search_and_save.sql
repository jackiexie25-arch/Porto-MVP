-- Phase 3: saving a cue with all its meanings in one step, and ranked cue search.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Query normalisation. Mirrors normaliseQuery() in src/lib/search.ts; both are tested
-- against the same cases in supabase/tests/normalise-cases.json.
-- Lowercase, apostrophes removed ("don't" → "dont"), any other punctuation becomes a space,
-- spaces collapsed and trimmed. "Cookie time!" → "cookie time".
-- ---------------------------------------------------------------------------
create function public.normalise_query(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(p_text, '')), '[''’‘`]', '', 'g'),
        '[^[:alnum:]]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- save_cue: creates or updates a cue and replaces its meanings, all in one transaction.
-- Runs as the caller, so RLS decides what they can touch. Meanings missing from the
-- payload are removed. A meaning's source is kept as it was (worker-note meanings stay so).
-- ---------------------------------------------------------------------------
create function public.save_cue(p_profile_id uuid, p_cue jsonb, p_meanings jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_cue ->> 'id', '')::uuid;
  v_pinned boolean := coalesce((p_cue ->> 'pinned')::boolean, false);
  v_order smallint;
  v_meaning jsonb;
  v_meaning_id uuid;
  v_keep uuid[] := '{}';
  v_aliases text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_cue -> 'aliases', '[]'))), '{}');
begin
  if jsonb_typeof(p_meanings) is distinct from 'array' or jsonb_array_length(p_meanings) = 0 then
    raise exception 'meaning_required' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.cues (profile_id, label, cue_type, description, aliases, category)
    values (
      p_profile_id,
      btrim(p_cue ->> 'label'),
      (p_cue ->> 'cue_type')::public.cue_type,
      coalesce(btrim(p_cue ->> 'description'), ''),
      v_aliases,
      (p_cue ->> 'category')::public.cue_category
    )
    returning id into v_id;
  else
    update public.cues
       set label = btrim(p_cue ->> 'label'),
           cue_type = (p_cue ->> 'cue_type')::public.cue_type,
           description = coalesce(btrim(p_cue ->> 'description'), ''),
           aliases = v_aliases,
           category = (p_cue ->> 'category')::public.cue_category
     where id = v_id and profile_id = p_profile_id;
    if not found then
      raise exception 'cue_not_found' using errcode = 'P0001';
    end if;
  end if;

  -- Pinning: keep an existing pin's place, or take the first free place from 1 to 5.
  if v_pinned then
    select pin_order into v_order from public.cues where id = v_id and pinned;
    if v_order is null then
      select min(n)::smallint into v_order
      from generate_series(1, 5) as n
      where n not in (
        select pin_order from public.cues
        where profile_id = p_profile_id and pinned and pin_order is not null and id <> v_id
      );
    end if;
    update public.cues set pinned = true, pin_order = v_order where id = v_id;
  else
    update public.cues set pinned = false, pin_order = null where id = v_id;
  end if;

  for v_meaning in select value from jsonb_array_elements(p_meanings) loop
    v_meaning_id := nullif(v_meaning ->> 'id', '')::uuid;
    if v_meaning_id is not null then
      update public.cue_meanings
         set context_tags = coalesce(array(select jsonb_array_elements_text(v_meaning -> 'context_tags'))::public.context_tag[], '{}'),
             context_text = coalesce(btrim(v_meaning ->> 'context_text'), ''),
             meaning = btrim(v_meaning ->> 'meaning'),
             what_to_do = coalesce(btrim(v_meaning ->> 'what_to_do'), ''),
             what_to_avoid = coalesce(btrim(v_meaning ->> 'what_to_avoid'), ''),
             confidence = coalesce(v_meaning ->> 'confidence', 'usually')::public.confidence
       where id = v_meaning_id and cue_id = v_id
       returning id into v_meaning_id;
    end if;
    if v_meaning_id is null then
      insert into public.cue_meanings (cue_id, context_tags, context_text, meaning, what_to_do, what_to_avoid, confidence)
      values (
        v_id,
        coalesce(array(select jsonb_array_elements_text(v_meaning -> 'context_tags'))::public.context_tag[], '{}'),
        coalesce(btrim(v_meaning ->> 'context_text'), ''),
        btrim(v_meaning ->> 'meaning'),
        coalesce(btrim(v_meaning ->> 'what_to_do'), ''),
        coalesce(btrim(v_meaning ->> 'what_to_avoid'), ''),
        coalesce(v_meaning ->> 'confidence', 'usually')::public.confidence
      )
      returning id into v_meaning_id;
    end if;
    v_keep := v_keep || v_meaning_id;
  end loop;

  delete from public.cue_meanings where cue_id = v_id and id <> all (v_keep);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_cues: ranked search over one profile's cues. Internal only: Phase 4's
-- worker_search() calls it after checking the share token. Never guesses: it returns
-- only cues the family wrote, and an empty list when nothing matches.
--
-- Rank, highest first:
--   4 exact label match · 3 exact alias match · 2 trigram match on label or aliases
--   (similarity or word similarity ≥ 0.25) · 1 full-text match on description and meanings.
-- Within a rank, cues with a meaning for the selected context come first, then closer matches.
-- Each cue's meanings are ordered with the selected context first.
-- ---------------------------------------------------------------------------
create function public.search_cues(
  p_profile_id uuid,
  p_query text,
  p_context public.context_tag default null,
  p_limit int default 5
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select public.normalise_query(left(p_query, 200)) as nq
  ),
  scored as (
    select
      c.id,
      c.label,
      c.cue_type,
      c.category,
      case
        when public.normalise_query(c.label) = q.nq then 4
        when exists (select 1 from unnest(c.aliases) a where public.normalise_query(a) = q.nq) then 3
        when greatest(
          extensions.similarity(public.normalise_query(c.label), q.nq),
          extensions.word_similarity(q.nq, public.normalise_query(c.label)),
          coalesce((
            select max(greatest(
              extensions.similarity(public.normalise_query(a), q.nq),
              extensions.word_similarity(q.nq, public.normalise_query(a))
            ))
            from unnest(c.aliases) a
          ), 0)
        ) >= 0.25 then 2
        when to_tsvector('english',
               c.description || ' ' || coalesce((
                 select string_agg(m.meaning || ' ' || m.context_text, ' ')
                 from public.cue_meanings m where m.cue_id = c.id
               ), '')
             ) @@ plainto_tsquery('english', q.nq) then 1
        else 0
      end as tier,
      greatest(
        extensions.similarity(public.normalise_query(c.label), q.nq),
        extensions.word_similarity(q.nq, public.normalise_query(c.label)),
        coalesce((
          select max(greatest(
            extensions.similarity(public.normalise_query(a), q.nq),
            extensions.word_similarity(q.nq, public.normalise_query(a))
          ))
          from unnest(c.aliases) a
        ), 0)
      ) as closeness,
      exists (
        select 1 from public.cue_meanings m
        where m.cue_id = c.id and p_context is not null and p_context = any (m.context_tags)
      ) as in_context
    from public.cues c, q
    where c.profile_id = p_profile_id and q.nq <> ''
  ),
  top as (
    select * from scored
    where tier > 0
    order by tier desc, in_context desc, closeness desc, label
    limit least(greatest(coalesce(p_limit, 5), 1), 5)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'label', t.label,
      'cue_type', t.cue_type,
      'category', t.category,
      'match', case t.tier when 4 then 'label' when 3 then 'alias' when 2 then 'similar' else 'meaning' end,
      'meanings', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'context_tags', m.context_tags,
            'context_text', m.context_text,
            'meaning', m.meaning,
            'what_to_do', m.what_to_do,
            'what_to_avoid', m.what_to_avoid,
            'confidence', m.confidence,
            'in_context', p_context is not null and p_context = any (m.context_tags)
          )
          order by (p_context is not null and p_context = any (m.context_tags)) desc, m.created_at
        ), '[]'::jsonb)
        from public.cue_meanings m where m.cue_id = t.id
      )
    )
    order by t.tier desc, t.in_context desc, t.closeness desc, t.label
  ), '[]'::jsonb)
  from top t;
$$;

revoke execute on function public.normalise_query(text) from public, anon, authenticated;
revoke execute on function public.save_cue(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.search_cues(uuid, text, public.context_tag, int) from public, anon, authenticated;

grant execute on function public.save_cue(uuid, jsonb, jsonb) to authenticated;
