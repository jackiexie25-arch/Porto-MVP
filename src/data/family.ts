import { getSupabase } from '../lib/supabase';
import type {
  CardSection,
  CardSectionKind,
  Cue,
  NewCue,
  NewMeaning,
  Profile,
  ProfilePatch,
  SectionDraft,
  ShiftNote,
} from './types';

const PROFILE_COLUMNS =
  'id, display_name, communication_modes, languages, language_style, connect_note, who_to_call_name, who_to_call_phone, setup_step, setup_started_at, setup_completed_at, updated_at';

export interface FamilyData {
  profile: Profile;
  sections: CardSection[];
  cues: Cue[];
  notes: ShiftNote[];
}

const NOTE_COLUMNS =
  'id, cue_id, cue_text, context_tags, context_text, tried, seemed_to_need, outcome, worker_name, status, resolved_to_cue_id, created_at, resolved_at, shares(label)';

/** Everything the family screens need. RLS limits every query to the signed-in family's rows. */
export async function fetchFamilyData(): Promise<FamilyData> {
  const supabase = getSupabase();
  const [profile, sections, cues, notes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).single(),
    supabase.from('card_sections').select('section, details, body, updated_at'),
    supabase
      .from('cues')
      .select('*, cue_meanings(*)')
      .order('created_at', { ascending: true })
      .order('created_at', { referencedTable: 'cue_meanings', ascending: true }),
    supabase.from('shift_notes').select(NOTE_COLUMNS).order('created_at', { ascending: false }),
  ]);
  if (profile.error) throw profile.error;
  if (sections.error) throw sections.error;
  if (cues.error) throw cues.error;
  if (notes.error) throw notes.error;
  return {
    profile: profile.data as Profile,
    sections: sections.data as CardSection[],
    cues: cues.data as Cue[],
    notes: notes.data as unknown as ShiftNote[],
  };
}

export async function updateProfile(id: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', id).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return data as Profile;
}

export async function saveSection(profileId: string, section: CardSectionKind, draft: SectionDraft): Promise<CardSection> {
  const details = Object.fromEntries(Object.entries(draft.details).filter(([, v]) => v.trim() !== ''));
  const { data, error } = await getSupabase()
    .from('card_sections')
    .upsert({ profile_id: profileId, section, details, body: draft.body }, { onConflict: 'profile_id,section' })
    .select('section, details, body, updated_at')
    .single();
  if (error) throw error;
  return data as CardSection;
}

export interface CueInput extends NewCue {
  id?: string;
  description: string;
  aliases: string[];
  pinned: boolean;
}

export interface MeaningInput extends NewMeaning {
  id?: string;
}

/**
 * Creates or updates a cue and all its meanings in one database transaction (save_cue),
 * then reads it back. Meanings left out of `meanings` are removed.
 */
export async function saveCue(profileId: string, cue: CueInput, meanings: MeaningInput[]): Promise<Cue> {
  const supabase = getSupabase();
  const saved = await supabase.rpc('save_cue', { p_profile_id: profileId, p_cue: cue, p_meanings: meanings });
  if (saved.error) throw saved.error;
  return readCue(saved.data as string);
}

async function readCue(id: string): Promise<Cue> {
  const row = await getSupabase()
    .from('cues')
    .select('*, cue_meanings(*)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'cue_meanings', ascending: true })
    .single();
  if (row.error) throw row.error;
  return row.data as Cue;
}

/** Adds a worker's note to the profile: saves the cue as confirmed and resolves the note, in one step. */
export async function approveNote(noteId: string, cue: CueInput, meanings: MeaningInput[]): Promise<Cue> {
  const saved = await getSupabase().rpc('approve_note', { p_note_id: noteId, p_cue: cue, p_meanings: meanings });
  if (saved.error) throw saved.error;
  return readCue(saved.data as string);
}

export async function dismissNote(noteId: string): Promise<void> {
  const { error } = await getSupabase().rpc('dismiss_note', { p_note_id: noteId });
  if (error) throw error;
}

export async function deleteCue(id: string): Promise<void> {
  const { error } = await getSupabase().from('cues').delete().eq('id', id);
  if (error) throw error;
}
