import type {
  CardSection,
  CommunicationMode,
  Confidence,
  ContextTag,
  CueCategory,
  CueType,
  LanguageStyle,
} from '../data/types';

export type ShareScope = 'card' | 'card_search' | 'card_search_log';

export interface WorkerMeaning {
  context_tags: ContextTag[];
  context_text: string;
  meaning: string;
  what_to_do: string;
  what_to_avoid: string;
  confidence: Confidence;
}

export interface WorkerCardData {
  status: 'ok';
  scope: ShareScope;
  expires_at: string;
  profile: {
    display_name: string;
    communication_modes: CommunicationMode[];
    languages: string[];
    language_style: LanguageStyle;
    connect_note: string;
    who_to_call_name: string;
    who_to_call_phone: string;
    updated_at: string;
  };
  sections: CardSection[];
  /** The family's cue labels, for the log form. Empty unless the link allows notes. */
  cue_options?: Array<{ id: string; label: string }>;
  cues: Array<{
    id: string;
    label: string;
    pinned: boolean;
    pin_order: number | null;
    created_at: string;
    updated_at: string;
    cue_meanings: WorkerMeaning[];
  }>;
}

/** 'closed' covers wrong, expired and closed links alike. 'busy' is the rate limit. */
export type WorkerCardResult = WorkerCardData | { status: 'closed' | 'busy' };

export interface SearchHit {
  id: string;
  label: string;
  cue_type: CueType;
  category: CueCategory;
  match: 'label' | 'alias' | 'similar' | 'meaning';
  meanings: Array<WorkerMeaning & { in_context: boolean }>;
}

export type WorkerSearchResult =
  | { status: 'ok'; results: SearchHit[] }
  | { status: 'closed' | 'busy' | 'not_allowed' };

export interface WorkerNote {
  cue_id: string | null;
  cue_text: string;
  context_tags: ContextTag[];
  context_text: string;
  tried: string;
  seemed_to_need: string;
  outcome: 'worked' | 'partly' | 'no';
  worker_name: string;
}

export type WorkerWriteResult = { status: 'ok' | 'closed' | 'busy' | 'not_allowed' | 'invalid' };

/** Where the worker view gets its data: a real share link, or the local demo. */
export interface WorkerSource {
  getCard: () => Promise<WorkerCardResult>;
  search: (query: string, context: ContextTag | null) => Promise<WorkerSearchResult>;
  logNote: (note: WorkerNote) => Promise<WorkerWriteResult>;
  feedback: (cueId: string, helpful: boolean) => Promise<WorkerWriteResult>;
}
