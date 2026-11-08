-- Phase 4: share links and the worker's read-only view.
-- Workers never have accounts. Every worker call passes the share token to a SECURITY DEFINER
-- function, which checks it through use_share() and returns only what that share allows.

alter table public.shares
  add column rate_window_start timestamptz,
  add column rate_count int not null default 0;

-- ---------------------------------------------------------------------------
-- use_share: the single gate for every worker call. Internal only.
--   'closed' → no such token, closed by the family, or expired (never says which)
--   'busy'   → more than 60 calls in the last minute on this link
--   'ok'     → counts the call and records when the link was first and last opened
-- ---------------------------------------------------------------------------
create function public.use_share(p_token text)
returns table (share_id uuid, profile_id uuid, scope public.share_scope, expires_at timestamptz, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.shares%rowtype;
  v_now timestamptz := now();
begin
  if p_token is null or char_length(p_token) <> 43 or p_token !~ '^[A-Za-z0-9_-]+$' then
    return query select null::uuid, null::uuid, null::public.share_scope, null::timestamptz, 'closed'::text;
    return;
  end if;

  select * into v from public.shares s
  where s.token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if not found or v.revoked_at is not null or v.expires_at <= v_now then
    return query select null::uuid, null::uuid, null::public.share_scope, null::timestamptz, 'closed'::text;
    return;
  end if;

  if v.rate_window_start is not null and v.rate_window_start > v_now - interval '1 minute' then
    if v.rate_count >= 60 then
      return query select null::uuid, null::uuid, null::public.share_scope, null::timestamptz, 'busy'::text;
      return;
    end if;
    update public.shares
       set rate_count = rate_count + 1,
           first_opened_at = coalesce(first_opened_at, v_now),
           last_opened_at = v_now
     where id = v.id;
  else
    update public.shares
       set rate_window_start = v_now,
           rate_count = 1,
           first_opened_at = coalesce(first_opened_at, v_now),
           last_opened_at = v_now
     where id = v.id;
  end if;

  return query select v.id, v.profile_id, v.scope, v.expires_at, 'ok'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Family: create and close share links.
-- ---------------------------------------------------------------------------

-- Returns the token once. Only its SHA-256 hash is stored.
create function public.create_share(
  p_label text,
  p_worker_name text,
  p_hours int,
  p_scope public.share_scope
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_token text;
  v_share public.shares%rowtype;
begin
  select id into v_profile from public.profiles where owner_id = auth.uid();
  if v_profile is null then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 336 then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;

  -- 32 random bytes, base64url without padding (43 characters).
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  insert into public.shares (profile_id, label, worker_name, token_hash, scope, expires_at)
  values (
    v_profile,
    btrim(p_label),
    coalesce(btrim(p_worker_name), ''),
    extensions.digest(v_token, 'sha256'),
    p_scope,
    now() + make_interval(hours => p_hours)
  )
  returning * into v_share;

  return jsonb_build_object('id', v_share.id, 'token', v_token, 'expires_at', v_share.expires_at);
end;
$$;

-- Closes a link straight away. Returns false if it wasn't this family's open link.
create function public.revoke_share(p_share_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.shares s
     set revoked_at = now()
   where s.id = p_share_id
     and s.revoked_at is null
     and s.profile_id in (select p.id from public.profiles p where p.owner_id = auth.uid());
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker: the first-shift card, and search.
-- ---------------------------------------------------------------------------

-- The card for this share: only what the card shows. No ids except cue ids (for feedback later).
create function public.worker_get_card(p_token text)
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
    ), '[]'::jsonb)
  );
end;
$$;

-- Ranked search for this share's profile. Logs the search for the family only.
create function public.worker_search(p_token text, p_query text, p_context public.context_tag default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v record;
  v_query text := left(btrim(coalesce(p_query, '')), 200);
  v_results jsonb;
begin
  select * into v from public.use_share(p_token);
  if v.outcome <> 'ok' then
    return jsonb_build_object('status', v.outcome);
  end if;
  if v.scope = 'card' then
    return jsonb_build_object('status', 'not_allowed');
  end if;
  if public.normalise_query(v_query) = '' then
    return jsonb_build_object('status', 'ok', 'results', '[]'::jsonb);
  end if;

  v_results := public.search_cues(v.profile_id, v_query, p_context, 5);

  insert into public.search_log (profile_id, share_id, query, context_tag, result_count)
  values (v.profile_id, v.share_id, v_query, p_context, jsonb_array_length(v_results));

  return jsonb_build_object('status', 'ok', 'results', v_results);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: internal helpers for nobody; family functions for authenticated;
-- worker functions for anon and authenticated (a family member may open a link too).
-- ---------------------------------------------------------------------------
revoke execute on function public.use_share(text) from public, anon, authenticated;
revoke execute on function public.create_share(text, text, int, public.share_scope) from public, anon;
revoke execute on function public.revoke_share(uuid) from public, anon;
revoke execute on function public.worker_get_card(text) from public;
revoke execute on function public.worker_search(text, text, public.context_tag) from public;

grant execute on function public.create_share(text, text, int, public.share_scope) to authenticated;
grant execute on function public.revoke_share(uuid) to authenticated;
grant execute on function public.worker_get_card(text) to anon, authenticated;
grant execute on function public.worker_search(text, text, public.context_tag) to anon, authenticated;
