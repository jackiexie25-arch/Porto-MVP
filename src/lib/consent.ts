/**
 * Must match public.consent_version() in the database. A DB test checks they agree.
 * Bump both (in a new migration) whenever the consent or privacy text changes: everyone is
 * asked to agree again on their next visit.
 *
 * 2026-11-v1: first version.
 * 2026-11-v2: names the services that help run Porto (Supabase, Resend, Netlify).
 */
export const CONSENT_VERSION = '2026-11-v2';
