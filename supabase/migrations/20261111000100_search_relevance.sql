-- Search relevance, design round 1: stop near-miss spellings from showing as matches.
--
-- The Phase 3 trigram tier (similarity or word similarity >= 0.25 against a whole label)
-- let short words that merely share a few letters through: "hungry" put "Hands over ears
-- and humming" first, "hit" returned four unrelated cues. A worker acts on the first
-- result, so that reads as the app guessing. See DECISIONS.md, "Search relevance".
--
-- Rank, highest first:
--   4 exact label · 3 exact alias
--   2 close match on the label or an alias. Either the whole query is very close to a label
--     or alias (similarity >= 0.45, for "cokie tme"), or every word typed (ignoring stop
--     words like "the" and "his") matches a word of the label or aliases: the same word, the
--     start of it when 3 or more letters are typed ("coo"), or a near spelling when 4 or more
--     letters are typed, starting with the same letter, with similarity >= 0.4 ("bathrom").
--   1 full-text match (english stemming) over the label, aliases, description and meanings,
--     so "hungry" finds "I'm hungry" and "waving" finds "wave".
-- Within a rank, cues with a meaning for the selected context come first, then closer matches.
-- Nothing else is returned: no match means an empty list, never a guess.
-- The in-browser demo (src/demo/demoSource.ts) mirrors these rules; both are checked against
-- supabase/tests/search-cases.json.

create or replace function public.search_cues(
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
    select
      n.nq,
      string_to_array(n.nq, ' ') as words,
      pg_catalog.numnode(pg_catalog.plainto_tsquery('english', n.nq)) > 0 as has_content,
      pg_catalog.plainto_tsquery('english', n.nq) as tsq
    from (select public.normalise_query(left(p_query, 200)) as nq) n
  ),
  cue as (
    select
      c.id,
      c.label,
      c.cue_type,
      c.category,
      public.normalise_query(c.label) as nl,
      array(select public.normalise_query(a) from unnest(c.aliases) a) as nas,
      pg_catalog.to_tsvector('english',
        c.label || ' ' || array_to_string(c.aliases, ' ') || ' ' || c.description || ' ' || coalesce((
          select string_agg(m.meaning || ' ' || m.context_text, ' ')
          from public.cue_meanings m where m.cue_id = c.id
        ), '')
      ) as doc,
      exists (
        select 1 from public.cue_meanings m
        where m.cue_id = c.id and p_context is not null and p_context = any (m.context_tags)
      ) as in_context
    from public.cues c
    where c.profile_id = p_profile_id
  ),
  named as (
    select
      cue.*,
      array(
        select w from unnest(string_to_array(cue.nl || ' ' || array_to_string(cue.nas, ' '), ' ')) w
        where w <> ''
      ) as name_words
    from cue
  ),
  scored as (
    select
      d.id,
      d.label,
      d.cue_type,
      d.category,
      d.in_context,
      case
        when d.nl = q.nq then 4
        when q.nq = any (d.nas) then 3
        when greatest(
          extensions.similarity(d.nl, q.nq),
          coalesce((select max(extensions.similarity(a, q.nq)) from unnest(d.nas) a), 0)
        ) >= 0.45 then 2
        when q.has_content and not exists (
          select 1 from unnest(q.words) qw
          where pg_catalog.numnode(pg_catalog.plainto_tsquery('english', qw)) > 0
            and not exists (
              select 1 from unnest(d.name_words) nw
              where nw = qw
                 or (length(qw) >= 3 and left(nw, length(qw)) = qw)
                 or (length(qw) >= 4 and left(nw, 1) = left(qw, 1) and extensions.similarity(qw, nw) >= 0.4)
            )
        ) then 2
        when d.doc @@ q.tsq then 1
        else 0
      end as tier,
      greatest(
        extensions.similarity(d.nl, q.nq),
        extensions.word_similarity(q.nq, d.nl),
        coalesce((
          select max(greatest(extensions.similarity(a, q.nq), extensions.word_similarity(q.nq, a)))
          from unnest(d.nas) a
        ), 0)
      ) as closeness
    from named d, q
    where q.nq <> ''
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

revoke execute on function public.search_cues(uuid, text, public.context_tag, int) from public, anon, authenticated;
