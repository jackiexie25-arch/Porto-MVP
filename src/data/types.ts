/** Row shapes for the tables the family app reads. These mirror supabase/migrations. */

export const COMMUNICATION_MODES = ['speech', 'echolalia', 'sounds', 'gestures', 'aac', 'other'] as const;
export type CommunicationMode = (typeof COMMUNICATION_MODES)[number];

export const LANGUAGE_STYLES = ['identity_first', 'person_first'] as const;
export type LanguageStyle = (typeof LANGUAGE_STYLES)[number];

export const CARD_SECTIONS = ['toileting', 'food_drink', 'overstimulation', 'calms', 'avoid'] as const;
export type CardSectionKind = (typeof CARD_SECTIONS)[number];

export const CUE_TYPES = ['phrase', 'sound', 'gesture', 'behaviour', 'aac', 'other'] as const;
export type CueType = (typeof CUE_TYPES)[number];

export const CUE_CATEGORIES = ['toileting', 'food_drink', 'overstimulation', 'connection', 'other'] as const;
export type CueCategory = (typeof CUE_CATEGORIES)[number];

export const CONTEXT_TAGS = ['home', 'school', 'camp', 'community', 'mealtime', 'transport', 'with_person', 'other'] as const;
export type ContextTag = (typeof CONTEXT_TAGS)[number];

export const CONFIDENCES = ['always', 'usually', 'sometimes'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export interface Profile {
  id: string;
  display_name: string;
  communication_modes: CommunicationMode[];
  languages: string[];
  language_style: LanguageStyle;
  connect_note: string;
  who_to_call_name: string;
  who_to_call_phone: string;
  setup_step: number;
  setup_started_at: string | null;
  setup_completed_at: string | null;
  updated_at: string;
}

/** Which prompt answers each section stores in `details`. Calms and avoid use `body`. Mirrors card_details_ok(). */
export const SECTION_DETAIL_KEYS = {
  toileting: ['signs', 'what_to_do', 'avoid'],
  food_drink: ['signs', 'routines', 'avoid'],
  overstimulation: ['triggers', 'early_signs'],
  calms: [],
  avoid: [],
} as const satisfies Record<CardSectionKind, readonly string[]>;

export type SectionDetailKey<S extends CardSectionKind> = (typeof SECTION_DETAIL_KEYS)[S][number];

export interface CardSection {
  section: CardSectionKind;
  details: Record<string, string>;
  body: string;
  updated_at: string;
}

export interface CueMeaning {
  id: string;
  cue_id: string;
  context_tags: ContextTag[];
  context_text: string;
  meaning: string;
  what_to_do: string;
  what_to_avoid: string;
  confidence: Confidence;
  source: 'family' | 'worker_note';
  created_at: string;
}

export interface Cue {
  id: string;
  label: string;
  cue_type: CueType;
  description: string;
  aliases: string[];
  category: CueCategory;
  pinned: boolean;
  pin_order: number | null;
  created_at: string;
  updated_at: string;
  cue_meanings: CueMeaning[];
}

export interface ShiftNote {
  id: string;
  cue_id: string | null;
  cue_text: string;
  context_tags: ContextTag[];
  context_text: string;
  tried: string;
  seemed_to_need: string;
  outcome: 'worked' | 'partly' | 'no';
  worker_name: string;
  status: 'pending' | 'approved' | 'dismissed';
  resolved_to_cue_id: string | null;
  created_at: string;
  resolved_at: string | null;
  /** Label of the link it came through, if that link still exists. */
  shares: { label: string } | null;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'display_name'
    | 'communication_modes'
    | 'languages'
    | 'language_style'
    | 'connect_note'
    | 'who_to_call_name'
    | 'who_to_call_phone'
    | 'setup_step'
    | 'setup_started_at'
    | 'setup_completed_at'
  >
>;

export interface SectionDraft {
  details: Record<string, string>;
  body: string;
}

export interface NewCue {
  label: string;
  cue_type: CueType;
  category: CueCategory;
}

export interface NewMeaning {
  context_tags: ContextTag[];
  context_text: string;
  meaning: string;
  what_to_do: string;
  what_to_avoid: string;
  confidence: Confidence;
}

/** Database text limits, so inputs can stop at the same length. */
export const LIMITS = {
  name: 40,
  connectNote: 300,
  languagesText: 200,
  detail: 500,
  sectionBody: 1500,
  cueLabel: 120,
  meaning: 500,
  contextText: 120,
  phone: 20,
} as const;
