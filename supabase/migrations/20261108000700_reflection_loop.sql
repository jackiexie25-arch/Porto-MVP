-- Phase 5: workers log what happened and say whether a cue helped; families review notes
-- and add them to the profile. Nothing a worker writes reaches the profile until the family adds it.

-- What the worker thinks the child needed. Optional; when given, "Add to profile" is one tap.
alter table public.shift_notes
  add column seemed_to_need text not null default '' check (char_length(seemed_to_need) <= 500);

-- ---------------------------------------------------------------------------
-- worker_get_card: unchanged, plus the family's cue labels for the log form on links that allow notes.
-- ---------------------------------------------------------------------------
create or replace function public.worker_get_card(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v record;
  v_profile public.profiles%rowtype;
begin
  select * into v from public.use_share(p_token);
  if v.outcome <> 'ok' then
    return jsonb_build_object('status', v.outcome);
  end if;

  select * into v_profile from public.profiles where id = v.profile_id;

  return jsonb_build_object(
    'status', 'ok',
    'scope', v.scope,
    'expires_at', v.expires_at,
    'profile', jsonb_build_object(
      'display_name', v_profile.display_name,
      'communication_modes', v_profile.communication_modes,
      'languages', v_profile.languages,
      'language_style', v_profile.language_style,
      'connect_note', v_profile.connect_note,
      'who_to_call_name', v_profile.who_to_call_name,
      'who_to_call_phone', v_profile.who_to_call_phone,
      'updated_at', v_profile.updated_at
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'section', s.section, 'details', s.details, 'body', s.body, 'updated_at', s.updated_at
      ))
      from public.card_sections s where s.profile_id = v.profile_id
    ), '[]'::jsonb),
    'cues', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'label', c.label,
        'pinned', c.pinned,
        'pin_order', c.pin_order,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'cue_meanings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'context_tags', m.context_tags,
            'context_text', m.context_text,
            'meaning', m.meaning,
            'what_to_do', m.what_to_do,
            'what_to_avoid', m.what_to_avoid,
            'confidence', m.confidence
          ) order by m.created_at)
          from public.cue_meanings m where m.cue_id = c.id
        ), '[]'::jsonb)
      ) order by c.pin_order)
      from public.cues c where c.profile_id = v.profile_id and c.pinned
    ), '[]'::jsonb),
    'cue_options', case when v.scope = 'card_search_log' then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label) order by c.label)
      from public.cues c where c.profile_id = v.profile_id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- worker_log_note: a short note for the family. Only on links that allow notes.
-- Text is trimmed to the column limits rather than refused, so a worker never loses a note.
-- ---------------------------------------------------------------------------
create function public.worker_log_note(p_token text, p_note jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v record;
  v_cue uuid := nullif(p_note ->> 'cue_id', '')::uuid;
  v_cue_text text := left(btrim(coalesce(p_note ->> 'cue_text', '')), 500);
  v_outcome public.note_outcome;
begin
  select * into v from public.use_share(p_token);
  if v.outcome <> 'ok' then
    return jsonb_build_object('status', v.outcome);
  end if;
  if v.scope <> 'card_search_log' then
    return jsonb_build_object('status', 'not_allowed');
  end if;

  -- A cue id must belong to this family; anything else is treated as invalid.
  if v_cue is not null and not exists (select 1 from public.cues where id = v_cue and profile_id = v.profile_id) then
    return jsonb_build_object('status', 'invalid');
  end if;
  if v_cue is null and v_cue_text = '' then
    return jsonb_build_object('status', 'invalid');
  end if;
  begin
    v_outcome := (p_note ->> 'outcome')::public.note_outcome;
  exception when invalid_text_representation then
    v_outcome := null;
  end;
  if v_outcome is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.shift_notes (
    profile_id, share_id, cue_id, cue_text, context_tags, context_text, tried, seemed_to_need, outcome, worker_name
  ) values (
    v.profile_id,
    v.share_id,
    v_cue,
    v_cue_text,
    coalesce(array(
      select t::public.context_tag from jsonb_array_elements_text(coalesce(p_note -> 'context_tags', '[]')) t
      where t in (select unnest(enum_range(null::public.context_tag))::text)
    ), '{}'),
    left(btrim(coalesce(p_note ->> 'context_text', '')), 500),
    left(btrim(coalesce(p_note ->> 'tried', '')), 500),
    left(btrim(coalesce(p_note ->> 'seemed_to_need', '')), 500),
    v_outcome,
    left(btrim(coalesce(p_note ->> 'worker_name', '')), 40)
  );

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- worker_cue_feedback: "Did this help? Yes / Not really" under a search result.
-- ---------------------------------------------------------------------------
create function public.worker_cue_feedback(p_token text, p_cue_id uuid, p_helpful boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select * into v from public.use_share(p_token);
  if v.outcome <> 'ok' then
    return jsonb_build_object('status', v.outcome);
  end if;
  if v.scope = 'card' then
    return jsonb_build_object('status', 'not_allowed');
  end if;
  if p_helpful is null or not exists (select 1 from public.cues where id = p_cue_id and profile_id = v.profile_id) then
    return jsonb_build_object('status', 'invalid');
  end if;

  insert into public.cue_feedback (cue_id, share_id, helpful) values (p_cue_id, v.share_id, p_helpful);
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ---------------------------------------------------------------------------
-- Family: add a note to the profile, or set it aside.
-- ---------------------------------------------------------------------------

-- Saves the cue (new or existing) exactly as the family confirmed it, marks the meanings this
-- save created as coming from the worker's note, and resolves the note. All in one transaction.
create function public.approve_note(p_note_id uuid, p_cue jsonb, p_meanings jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note public.shift_notes%rowtype;
  v_existing uuid := nullif(p_cue ->> 'id', '')::uuid;
  v_before uuid[] := '{}';
  v_cue uuid;
begin
  select n.* into v_note
  from public.shift_notes n
  join public.profiles p on p.id = n.profile_id
  where n.id = p_note_id and p.owner_id = auth.uid() and n.status = 'pending'
  for update of n;
  if not found then
    raise exception 'note_not_found' using errcode = 'P0001';
  end if;

  if v_existing is not null then
    if not exists (select 1 from public.cues where id = v_existing and profile_id = v_note.profile_id) then
      raise exception 'cue_not_found' using errcode = 'P0001';
    end if;
    v_before := array(select id from public.cue_meanings where cue_id = v_existing);
  end if;

  v_cue := public.save_cue(v_note.profile_id, p_cue, p_meanings);

  update public.cue_meanings
     set source = 'worker_note', source_note_id = v_note.id
   where cue_id = v_cue and not (id = any (v_before));

  update public.shift_notes
     set status = 'approved', resolved_to_cue_id = v_cue, resolved_at = now()
   where id = v_note.id;

  return v_cue;
end;
$$;

create function public.dismiss_note(p_note_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.shift_notes n
     set status = 'dismissed', resolved_at = now()
   where n.id = p_note_id
     and n.status = 'pending'
     and n.profile_id in (select p.id from public.profiles p where p.owner_id = auth.uid());
  return found;
end;
$$;

revoke execute on function public.worker_log_note(text, jsonb) from public;
revoke execute on function public.worker_cue_feedback(text, uuid, boolean) from public;
revoke execute on function public.approve_note(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.dismiss_note(uuid) from public, anon;

grant execute on function public.worker_log_note(text, jsonb) to anon, authenticated;
grant execute on function public.worker_cue_feedback(text, uuid, boolean) to anon, authenticated;
grant execute on function public.approve_note(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.dismiss_note(uuid) to authenticated;
