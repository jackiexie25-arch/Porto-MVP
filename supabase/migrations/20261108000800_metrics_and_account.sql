-- Phase 6: first-party trial metrics, the /team aggregates, and deleting an account.
-- Events carry names and minimal props only: no free text, worker names or search queries.

-- ---------------------------------------------------------------------------
-- record_event: internal. Every event goes through here.
-- ---------------------------------------------------------------------------
create function public.record_event(p_name public.event_name, p_profile_id uuid, p_props jsonb default '{}')
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.events (name, profile_id, props) values (p_name, p_profile_id, coalesce(p_props, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Events the database records itself, from the rows they describe.
-- Trigger functions are definer so they can write to events, which no client can touch.
-- ---------------------------------------------------------------------------
create function public.events_on_profile_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('signup_completed', new.id);
  return null;
end;
$$;
create trigger events_profile_insert after insert on public.profiles
  for each row execute function public.events_on_profile_insert();

create function public.events_on_consent_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('consent_given', (select id from public.profiles where owner_id = new.user_id));
  return null;
end;
$$;
create trigger events_consent_insert after insert on public.consents
  for each row execute function public.events_on_consent_insert();

create function public.events_on_cue_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('cue_created', new.profile_id);
  return null;
end;
$$;
create trigger events_cue_insert after insert on public.cues
  for each row execute function public.events_on_cue_insert();

create function public.events_on_share_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('share_created', new.profile_id, jsonb_build_object(
    'scope', new.scope,
    'duration_hours', round(extract(epoch from (new.expires_at - new.created_at)) / 3600)::int
  ));
  return null;
end;
$$;
create trigger events_share_insert after insert on public.shares
  for each row execute function public.events_on_share_insert();

-- First open only.
create function public.events_on_share_opened() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.first_opened_at is null and new.first_opened_at is not null then
    perform public.record_event('share_opened', new.profile_id);
  end if;
  return null;
end;
$$;
create trigger events_share_opened after update of first_opened_at on public.shares
  for each row execute function public.events_on_share_opened();

create function public.events_on_search() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('worker_search', new.profile_id, jsonb_build_object('had_results', new.result_count > 0));
  return null;
end;
$$;
create trigger events_search after insert on public.search_log
  for each row execute function public.events_on_search();

create function public.events_on_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event(
    'cue_feedback',
    (select profile_id from public.cues where id = new.cue_id),
    jsonb_build_object('helpful', new.helpful)
  );
  return null;
end;
$$;
create trigger events_feedback after insert on public.cue_feedback
  for each row execute function public.events_on_feedback();

create function public.events_on_note_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_event('note_logged', new.profile_id);
  return null;
end;
$$;
create trigger events_note_insert after insert on public.shift_notes
  for each row execute function public.events_on_note_insert();

create function public.events_on_note_resolved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    perform public.record_event('note_approved', new.profile_id);
  elsif old.status = 'pending' and new.status = 'dismissed' then
    perform public.record_event('note_dismissed', new.profile_id);
  end if;
  return null;
end;
$$;
create trigger events_note_resolved after update of status on public.shift_notes
  for each row execute function public.events_on_note_resolved();

-- signup_started: counted when someone enters a valid, unused invite code on the sign-up form.
create or replace function public.check_invite_code(p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.invite_codes
    where code = public.normalise_invite_code(p_code) and used_at is null
  ) into v_ok;
  if v_ok then
    perform public.record_event('signup_started', null);
  end if;
  return v_ok;
end;
$$;

-- ---------------------------------------------------------------------------
-- log_event: the few events only the browser knows about. A fixed list, and props are
-- rebuilt here rather than trusted. Minutes for onboarding are worked out from the profile.
-- ---------------------------------------------------------------------------
create function public.log_event(p_name text, p_props jsonb default '{}')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_step int;
begin
  select * into v_profile from public.profiles where owner_id = auth.uid();
  if v_profile.id is null then
    return;
  end if;

  case p_name
    when 'onboarding_step_completed' then
      v_step := case when (p_props ->> 'step') ~ '^[1-6]$' then (p_props ->> 'step')::int end;
      if v_step is not null then
        perform public.record_event('onboarding_step_completed', v_profile.id, jsonb_build_object('step', v_step));
      end if;
    when 'onboarding_completed' then
      if v_profile.setup_started_at is not null and not exists (
        select 1 from public.events where profile_id = v_profile.id and name = 'onboarding_completed'
      ) then
        perform public.record_event('onboarding_completed', v_profile.id, jsonb_build_object(
          'minutes', round(extract(epoch from (coalesce(v_profile.setup_completed_at, now()) - v_profile.setup_started_at)) / 60)::int
        ));
      end if;
    when 'card_viewed_by_family' then
      perform public.record_event('card_viewed_by_family', v_profile.id);
    when 'profile_exported' then
      perform public.record_event('profile_exported', v_profile.id);
    else
      null; -- Anything else is ignored.
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_my_account: hard-deletes the profile, everything in it, the consent records and the
-- sign-in account. Every share link stops working at once. The family types their child's
-- name (or DELETE if there's no name yet) to confirm.
-- ---------------------------------------------------------------------------
create function public.delete_my_account(p_confirm text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_expected text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select * into v_profile from public.profiles where owner_id = v_uid;
  v_expected := coalesce(nullif(btrim(v_profile.display_name), ''), 'DELETE');
  if lower(btrim(coalesce(p_confirm, ''))) <> lower(v_expected) then
    raise exception 'confirm_mismatch' using errcode = 'P0001';
  end if;

  -- Recorded without a profile id, so it survives the cascade and says nothing about the family.
  perform public.record_event('profile_deleted', null);

  delete from public.profiles where owner_id = v_uid;
  delete from auth.users where id = v_uid;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- team_metrics: aggregates only, for emails in team_members. Never returns cue text, search
-- queries, worker names, notes, family names or emails. Families appear as "Family 1", "Family 2".
-- ---------------------------------------------------------------------------
create function public.team_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null or not exists (select 1 from public.team_members where email = v_email) then
    return jsonb_build_object('status', 'not_team');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'generated_at', now(),
    'funnel', jsonb_build_object(
      'signed_up', (select count(*) from public.profiles),
      'completed_onboarding', (select count(*) from public.profiles where setup_completed_at is not null),
      'created_share', (select count(distinct profile_id) from public.shares),
      'worker_opened', (select count(distinct profile_id) from public.shares where first_opened_at is not null),
      'worker_searched', (select count(distinct profile_id) from public.search_log),
      'note_logged', (select count(distinct profile_id) from public.shift_notes),
      'note_approved', (select count(distinct profile_id) from public.shift_notes where status = 'approved')
    ),
    'median_onboarding_minutes', (
      select round((percentile_cont(0.5) within group (
        order by extract(epoch from (setup_completed_at - setup_started_at)) / 60
      ))::numeric, 1)
      from public.profiles
      where setup_completed_at is not null and setup_started_at is not null
    ),
    'searches', (select count(*) from public.search_log),
    'opened_shares', (select count(*) from public.shares where first_opened_at is not null),
    'searches_per_opened_share', (
      select round(count(*)::numeric / nullif((select count(*) from public.shares where first_opened_at is not null), 0), 1)
      from public.search_log
    ),
    'zero_result_rate', (
      select round(avg(case when result_count = 0 then 1.0 else 0.0 end), 3) from public.search_log
    ),
    'helped_rate', (select round(avg(case when helpful then 1.0 else 0.0 end), 3) from public.cue_feedback),
    'feedback_count', (select count(*) from public.cue_feedback),
    'notes_logged', (select count(*) from public.shift_notes),
    'notes_approved', (select count(*) from public.shift_notes where status = 'approved'),
    'notes_dismissed', (select count(*) from public.shift_notes where status = 'dismissed'),
    'approval_rate', (
      select round(count(*) filter (where status = 'approved')::numeric / nullif(count(*) filter (where status <> 'pending'), 0), 3)
      from public.shift_notes
    ),
    'families', coalesce((
      select jsonb_agg(f order by f ->> 'family')
      from (
        select jsonb_build_object(
          'family', 'Family ' || lpad(row_number() over (order by p.created_at)::text, 2, '0'),
          'completed_onboarding', p.setup_completed_at is not null,
          'onboarding_minutes', case when p.setup_completed_at is not null and p.setup_started_at is not null
            then round(extract(epoch from (p.setup_completed_at - p.setup_started_at)) / 60)::int end,
          'cues', (select count(*) from public.cues c where c.profile_id = p.id),
          'shares', (select count(*) from public.shares s where s.profile_id = p.id),
          'shares_opened', (select count(*) from public.shares s where s.profile_id = p.id and s.first_opened_at is not null),
          'searches', (select count(*) from public.search_log l where l.profile_id = p.id),
          'notes_logged', (select count(*) from public.shift_notes n where n.profile_id = p.id),
          'notes_approved', (select count(*) from public.shift_notes n where n.profile_id = p.id and n.status = 'approved'),
          'card_views', (select count(*) from public.events e where e.profile_id = p.id and e.name = 'card_viewed_by_family')
        ) as f
        from public.profiles p
      ) rows
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.record_event(public.event_name, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.events_on_profile_insert() from public, anon, authenticated;
revoke execute on function public.events_on_consent_insert() from public, anon, authenticated;
revoke execute on function public.events_on_cue_insert() from public, anon, authenticated;
revoke execute on function public.events_on_share_insert() from public, anon, authenticated;
revoke execute on function public.events_on_share_opened() from public, anon, authenticated;
revoke execute on function public.events_on_search() from public, anon, authenticated;
revoke execute on function public.events_on_feedback() from public, anon, authenticated;
revoke execute on function public.events_on_note_insert() from public, anon, authenticated;
revoke execute on function public.events_on_note_resolved() from public, anon, authenticated;
revoke execute on function public.log_event(text, jsonb) from public, anon;
revoke execute on function public.delete_my_account(text) from public, anon;
revoke execute on function public.team_metrics() from public, anon;

grant execute on function public.log_event(text, jsonb) to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;
grant execute on function public.team_metrics() to authenticated;
