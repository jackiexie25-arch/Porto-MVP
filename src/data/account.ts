import { downloadText } from '../lib/csv';
import { getSupabase } from '../lib/supabase';

export const EXPORT_SCHEMA_VERSION = 1;

/**
 * Everything Porto holds about this family, as one JSON document (schema_version 1).
 * Read through the family's own access rules, so it can only ever contain their rows.
 * Share tokens are never included (only hashes are stored, and those stay behind too).
 */
export async function buildExport(): Promise<Record<string, unknown>> {
  const supabase = getSupabase();
  const [profile, sections, cues, shares, notes, searches, feedback, consents] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'display_name, communication_modes, languages, language_style, connect_note, who_to_call_name, who_to_call_phone, setup_started_at, setup_completed_at, created_at, updated_at',
      )
      .single(),
    supabase.from('card_sections').select('section, details, body, updated_at').order('section'),
    supabase
      .from('cues')
      .select(
        'id, label, cue_type, description, aliases, category, pinned, pin_order, created_at, updated_at, meanings:cue_meanings(context_tags, context_text, meaning, what_to_do, what_to_avoid, confidence, source, source_note_id, created_at)',
      )
      .order('created_at'),
    supabase
      .from('shares')
      .select('id, label, worker_name, scope, created_at, expires_at, revoked_at, first_opened_at, last_opened_at')
      .order('created_at'),
    supabase
      .from('shift_notes')
      .select('id, share_id, cue_id, cue_text, context_tags, context_text, tried, seemed_to_need, outcome, worker_name, status, resolved_to_cue_id, created_at, resolved_at')
      .order('created_at'),
    supabase.from('search_log').select('share_id, query, context_tag, result_count, created_at').order('created_at'),
    supabase.from('cue_feedback').select('cue_id, share_id, helpful, created_at').order('created_at'),
    supabase.from('consents').select('version, accepted_at').order('accepted_at'),
  ]);
  for (const r of [profile, sections, cues, shares, notes, searches, feedback, consents]) {
    if (r.error) throw r.error;
  }
  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    source: 'Porto trial',
    profile: profile.data,
    card_sections: sections.data,
    cues: cues.data,
    shares: shares.data,
    shift_notes: notes.data,
    search_log: searches.data,
    cue_feedback: feedback.data,
    consents: consents.data,
  };
}

/** "porto-ari-2026-11-08.json". Only letters and numbers from the name, so the file name is safe. */
export function exportFileName(name: string, date: Date = new Date()): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  return `porto-${slug}-${date.toISOString().slice(0, 10)}.json`;
}

export function downloadJson(data: unknown, fileName: string): void {
  downloadText(JSON.stringify(data, null, 2), fileName, 'application/json');
}

/** Hard-deletes the profile, everything in it, consent records and the sign-in account. */
export async function deleteAccount(confirm: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account', { p_confirm: confirm });
  if (error) throw error;
}
