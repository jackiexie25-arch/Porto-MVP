-- Porto schema: enums and tables.
-- Meaning is always meaning in a context: cues hold one or more cue_meanings, each with context tags.
-- Everything analysable is an enum, not a free string.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.communication_mode as enum ('speech', 'echolalia', 'sounds', 'gestures', 'aac', 'other');
create type public.language_style as enum ('identity_first', 'person_first');
create type public.card_section_kind as enum ('toileting', 'food_drink', 'overstimulation', 'calms', 'avoid');
create type public.cue_type as enum ('phrase', 'sound', 'gesture', 'behaviour', 'aac', 'other');
create type public.cue_category as enum ('toileting', 'food_drink', 'overstimulation', 'connection', 'other');
create type public.context_tag as enum ('home', 'school', 'camp', 'community', 'mealtime', 'transport', 'with_person', 'other');
create type public.confidence as enum ('always', 'usually', 'sometimes');
create type public.meaning_source as enum ('family', 'worker_note');
create type public.share_scope as enum ('card', 'card_search', 'card_search_log');
create type public.note_outcome as enum ('worked', 'partly', 'no');
create type public.note_status as enum ('pending', 'approved', 'dismissed');
create type public.event_name as enum (
  'signup_started', 'signup_completed', 'consent_given', 'onboarding_step_completed',
  'onboarding_completed', 'cue_created', 'card_viewed_by_family', 'share_created',
  'share_opened', 'worker_search', 'cue_feedback', 'note_logged', 'note_approved',
  'note_dismissed', 'profile_exported', 'profile_deleted'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when every element is a non-empty string within max_len, and there are at most max_items.
create function public.text_array_ok(arr text[], max_items int, max_len int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(arr), 0) <= max_items
     and not exists (
       select 1 from unnest(arr) as x
       where x is null or char_length(x) = 0 or char_length(x) > max_len
     );
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Family-owned tables
-- ---------------------------------------------------------------------------

-- One profile per family account for the trial (multi-child management is out of scope).
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  communication_modes public.communication_mode[] not null default '{}',
  languages text[] not null default '{}' check (public.text_array_ok(languages, 10, 40)),
  language_style public.language_style not null default 'identity_first',
  connect_note text not null default '' check (char_length(connect_note) <= 300),
  who_to_call_name text not null default '' check (char_length(who_to_call_name) <= 40),
  who_to_call_phone text not null default '' check (char_length(who_to_call_phone) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  section public.card_section_kind not null,
  body text not null default '' check (char_length(body) <= 1500),
  updated_at timestamptz not null default now(),
  unique (profile_id, section)
);

create table public.cues (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  cue_type public.cue_type not null,
  description text not null default '' check (char_length(description) <= 500),
  aliases text[] not null default '{}' check (public.text_array_ok(aliases, 20, 80)),
  category public.cue_category not null,
  pinned boolean not null default false,
  pin_order smallint check (pin_order between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cues_profile_id_idx on public.cues (profile_id);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  worker_name text not null default '' check (char_length(worker_name) <= 40),
  token_hash bytea not null unique,
  scope public.share_scope not null default 'card_search_log',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '14 days 1 minute')
);
create index shares_profile_id_idx on public.shares (profile_id);

create table public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  share_id uuid references public.shares (id) on delete set null,
  cue_id uuid references public.cues (id) on delete set null,
  cue_text text not null default '' check (char_length(cue_text) <= 500),
  context_tags public.context_tag[] not null default '{}',
  context_text text not null default '' check (char_length(context_text) <= 500),
  tried text not null default '' check (char_length(tried) <= 500),
  outcome public.note_outcome not null,
  worker_name text not null default '' check (char_length(worker_name) <= 40),
  status public.note_status not null default 'pending',
  resolved_to_cue_id uuid references public.cues (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index shift_notes_profile_id_idx on public.shift_notes (profile_id);

create table public.cue_meanings (
  id uuid primary key default gen_random_uuid(),
  cue_id uuid not null references public.cues (id) on delete cascade,
  context_tags public.context_tag[] not null default '{}',
  context_text text not null default '' check (char_length(context_text) <= 120),
  meaning text not null check (char_length(meaning) between 1 and 500),
  what_to_do text not null default '' check (char_length(what_to_do) <= 500),
  what_to_avoid text not null default '' check (char_length(what_to_avoid) <= 500),
  confidence public.confidence not null default 'usually',
  source public.meaning_source not null default 'family',
  source_note_id uuid references public.shift_notes (id) on delete set null,
  created_at timestamptz not null default now()
);
create index cue_meanings_cue_id_idx on public.cue_meanings (cue_id);

-- Visible only to the owning family. Never shown on /team.
create table public.search_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  share_id uuid references public.shares (id) on delete set null,
  query text not null check (char_length(query) <= 200),
  context_tag public.context_tag,
  result_count int not null check (result_count >= 0),
  created_at timestamptz not null default now()
);
create index search_log_profile_id_idx on public.search_log (profile_id);

create table public.cue_feedback (
  id uuid primary key default gen_random_uuid(),
  cue_id uuid not null references public.cues (id) on delete cascade,
  share_id uuid references public.shares (id) on delete set null,
  helpful boolean not null,
  created_at timestamptz not null default now()
);
create index cue_feedback_cue_id_idx on public.cue_feedback (cue_id);

-- ---------------------------------------------------------------------------
-- Account and trial tables
-- ---------------------------------------------------------------------------

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);

-- Codes are stored uppercase with no spaces. "Unused" means used_at is null.
create table public.invite_codes (
  code text primary key check (code = upper(code) and code !~ '\s' and char_length(code) between 6 and 40),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- First-party analytics: names and minimal props only. No free text, worker names or queries.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name public.event_name not null,
  profile_id uuid references public.profiles (id) on delete cascade,
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and char_length(props::text) <= 500),
  created_at timestamptz not null default now()
);
create index events_name_idx on public.events (name);

create table public.team_members (
  email text primary key check (email = lower(email) and position('@' in email) > 1)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger card_sections_updated_at before update on public.card_sections
  for each row execute function public.set_updated_at();
create trigger cues_updated_at before update on public.cues
  for each row execute function public.set_updated_at();

-- At most 5 pinned cues per profile.
create function public.enforce_pin_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pinned and (
    select count(*) from public.cues
    where profile_id = new.profile_id and pinned and id <> new.id
  ) >= 5 then
    raise exception 'pin_limit' using errcode = 'P0001', hint = 'A profile can pin up to 5 cues.';
  end if;
  if not new.pinned then
    new.pin_order := null;
  end if;
  return new;
end;
$$;

create trigger cues_pin_limit before insert or update of pinned, profile_id on public.cues
  for each row execute function public.enforce_pin_limit();
