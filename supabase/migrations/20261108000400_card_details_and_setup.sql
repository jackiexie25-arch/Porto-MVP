-- Phase 2: structured answers on card sections, and guided-setup progress on profiles.

-- Each card section keeps the answer to each setup prompt separately, so the card can label them
-- ("How they show it", "What to do", "Avoid") and exports stay structured.
-- Allowed keys per section; every value is a string of at most 500 characters.
create function public.card_details_ok(p_section public.card_section_kind, p_details jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_details) = 'object'
     and not exists (
       select 1 from jsonb_each(p_details) as d(key, value)
       where jsonb_typeof(d.value) <> 'string'
          or char_length(d.value #>> '{}') > 500
          or d.key <> all (
            case p_section
              when 'toileting' then array['signs', 'what_to_do', 'avoid']
              when 'food_drink' then array['signs', 'routines', 'avoid']
              when 'overstimulation' then array['triggers', 'early_signs']
              else array[]::text[]
            end
          )
     );
$$;

revoke execute on function public.card_details_ok(public.card_section_kind, jsonb) from public, anon;
grant execute on function public.card_details_ok(public.card_section_kind, jsonb) to authenticated;

alter table public.card_sections
  add column details jsonb not null default '{}'
  constraint card_sections_details_ok check (public.card_details_ok(section, details));

-- Guided setup: where the family is up to, and timings for the "about 15 minutes" measure.
alter table public.profiles
  add column setup_step smallint not null default 1 check (setup_step between 1 and 6),
  add column setup_started_at timestamptz,
  add column setup_completed_at timestamptz;

grant update (setup_step, setup_started_at, setup_completed_at) on public.profiles to authenticated;
