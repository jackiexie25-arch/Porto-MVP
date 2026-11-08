-- Family sign-up: invite codes, consent version and profile creation.

-- The consent version families must accept. Keep in step with CONSENT_VERSION in src/lib/consent.ts.
create function public.consent_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-v1'::text $$;

-- Invite codes are compared uppercase with all whitespace removed.
create function public.normalise_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$ select upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) $$;

-- Friendly early check on the sign-up form. Codes are long and random, so this can't be used to guess one.
create function public.check_invite_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invite_codes
    where code = public.normalise_invite_code(p_code) and used_at is null
  );
$$;

-- Creates the signed-in family's profile. Requires current consent and a valid, unused invite code,
-- which it marks used in the same statement. Calling it again returns the existing profile.
create function public.create_profile(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.consents
    where user_id = v_uid and version = public.consent_version()
  ) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  select id into v_profile from public.profiles where owner_id = v_uid;
  if found then
    return v_profile;
  end if;

  update public.invite_codes
     set used_by = v_uid, used_at = now()
   where code = public.normalise_invite_code(p_invite_code)
     and used_at is null;
  if not found then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;

  insert into public.profiles (owner_id) values (v_uid) returning id into v_profile;
  return v_profile;
end;
$$;

revoke execute on function public.consent_version() from public, anon, authenticated;
revoke execute on function public.normalise_invite_code(text) from public, anon, authenticated;
revoke execute on function public.check_invite_code(text) from public;
revoke execute on function public.create_profile(text) from public, anon;

grant execute on function public.consent_version() to authenticated;
grant execute on function public.check_invite_code(text) to anon, authenticated;
grant execute on function public.create_profile(text) to authenticated;
