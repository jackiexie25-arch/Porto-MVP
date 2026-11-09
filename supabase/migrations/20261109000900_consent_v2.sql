-- Consent version 2: the privacy text now names the services that help run Porto
-- (Supabase in Sydney, Resend for sign-in emails, Netlify for the website).
-- Everyone is asked to agree again on their next visit. Keep in step with src/lib/consent.ts.

create or replace function public.consent_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-v2'::text $$;
