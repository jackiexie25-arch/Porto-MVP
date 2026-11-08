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
} from './types';

const PROFILE_COLUMNS =
  'id, display_name, communication_modes, languages, language_style, connect_note, who_to_call_name, who_to_call_phone, setup_step, setup_started_at, setup_completed_at, updated_at';

export interface FamilyData {
  profile: Profile;
  sections: CardSection[];
  cues: Cue[];
}

/** Everything the family screens need. RLS limits every query to the signed-in family's rows. */
export async function fetchFamilyData(): Promise<FamilyData> {
  const supabase = getSupabase();
  const [profile, sections, cues] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).single(),
    supabase.from('card_sections').select('section, details, body, updated_at'),
    supabase
      .from('cues')
      .select('*, cue_meanings(*)')
      .order('created_at', { ascending: true })
      .order('created_at', { referencedTable: 'cue_meanings', ascending: true }),
  ]);
  if (profile.error) throw profile.error;
  if (sections.error) throw sections.error;
  if (cues.error) throw cues.error;
  return {
    profile: profile.data as Profile,
    sections: sections.data as CardSection[],
    cues: cues.data as Cue[],
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

/**
 * Adds a cue with its first meaning. If the meaning can't be saved, the cue is removed again,
 * so the family never ends up with a cue that has no meaning.
 */
export async function addCue(
  profileId: string,
  cue: NewCue,
  meaning: NewMeaning,
  pin: { pinned: boolean; pin_order: number | null },
): Promise<Cue> {
  const supabase = getSupabase();
  const created = await supabase
    .from('cues')
    .insert({ profile_id: profileId, ...cue, ...pin })
    .select('*')
    .single();
  if (created.error) throw created.error;
  const row = created.data as Omit<Cue, 'cue_meanings'>;

  const m = await supabase
    .from('cue_meanings')
    .insert({ cue_id: row.id, ...meaning })
    .select('*')
    .single();
  if (m.error) {
    await supabase.from('cues').delete().eq('id', row.id);
    throw m.error;
  }
  return { ...row, cue_meanings: [m.data as Cue['cue_meanings'][number]] };
}
