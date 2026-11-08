-- Row Level Security and grants.
-- Families read and write only rows under a profile they own.
-- anon has no direct access to any table: workers go through SECURITY DEFINER RPCs (Phase 4).

-- ---------------------------------------------------------------------------
-- Start from nothing: remove Supabase's default broad grants.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Check constraints call this as the writing user.
grant execute on function public.text_array_ok(text[], int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Ownership helpers (definer, so policies never recurse through RLS)
-- ---------------------------------------------------------------------------
create function public.owns_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile_id and owner_id = auth.uid()
  );
$$;

create function public.owns_cue(p_cue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cues c
    join public.profiles p on p.id = c.profile_id
    where c.id = p_cue_id and p.owner_id = auth.uid()
  );
$$;

revoke execute on function public.owns_profile(uuid) from public, anon;
revoke execute on function public.owns_cue(uuid) from public, anon;
grant execute on function public.owns_profile(uuid) to authenticated;
grant execute on function public.owns_cue(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.card_sections enable row level security;
alter table public.cues enable row level security;
alter table public.cue_meanings enable row level security;
alter table public.shares enable row level security;
alter table public.shift_notes enable row level security;
alter table public.search_log enable row level security;
alter table public.cue_feedback enable row level security;
alter table public.consents enable row level security;
alter table public.invite_codes enable row level security;
alter table public.events enable row level security;
alter table public.team_members enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: created only by create_profile(); owner_id can never change.
-- ---------------------------------------------------------------------------
grant select, delete on public.profiles to authenticated;
grant update (
  display_name, communication_modes, languages, language_style,
  connect_note, who_to_call_name, who_to_call_phone
) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (owner_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- card_sections, cues: full CRUD on your own profile
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.card_sections to authenticated;
create policy card_sections_all on public.card_sections for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

grant select, insert, update, delete on public.cues to authenticated;
create policy cues_all on public.cues for all to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

grant select, insert, update, delete on public.cue_meanings to authenticated;
create policy cue_meanings_all on public.cue_meanings for all to authenticated
  using (public.owns_cue(cue_id)) with check (public.owns_cue(cue_id));

-- ---------------------------------------------------------------------------
-- shares: read only. Created and closed through RPCs (tokens are made server-side).
-- ---------------------------------------------------------------------------
grant select on public.shares to authenticated;
create policy shares_select on public.shares for select to authenticated
  using (public.owns_profile(profile_id));

-- ---------------------------------------------------------------------------
-- Worker-created rows: families read them; changes go through RPCs.
-- ---------------------------------------------------------------------------
grant select on public.shift_notes to authenticated;
create policy shift_notes_select on public.shift_notes for select to authenticated
  using (public.owns_profile(profile_id));

grant select on public.search_log to authenticated;
create policy search_log_select on public.search_log for select to authenticated
  using (public.owns_profile(profile_id));

grant select on public.cue_feedback to authenticated;
create policy cue_feedback_select on public.cue_feedback for select to authenticated
  using (public.owns_cue(cue_id));

-- ---------------------------------------------------------------------------
-- consents: your own, insert and read only (a consent record is never edited).
-- ---------------------------------------------------------------------------
grant select, insert on public.consents to authenticated;
create policy consents_select on public.consents for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid());

-- invite_codes, events, team_members: no client access at all (RLS on, no policies, no grants).
