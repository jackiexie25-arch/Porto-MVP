import { copy } from '../../copy/en-AU';
import type { CueInput, MeaningInput } from '../../data/family';
import type { Confidence, ContextTag, Cue, CueCategory, CueType, ShiftNote } from '../../data/types';

export interface MeaningDraft {
  /** Stable key for React lists, also for meanings not saved yet. */
  key: string;
  id?: string;
  context_tags: ContextTag[];
  context_text: string;
  meaning: string;
  what_to_do: string;
  what_to_avoid: string;
  confidence: Confidence;
}

export interface CueEditorDraft {
  id?: string;
  label: string;
  cue_type: CueType;
  description: string;
  aliasesText: string;
  category: CueCategory;
  pinned: boolean;
  meanings: MeaningDraft[];
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `meaning-${keyCounter}`;
}

export function emptyMeaning(): MeaningDraft {
  return {
    key: nextKey(),
    context_tags: [],
    context_text: '',
    meaning: '',
    what_to_do: '',
    what_to_avoid: '',
    confidence: 'usually',
  };
}

export function emptyCueEditorDraft(pinned: boolean): CueEditorDraft {
  return {
    label: '',
    cue_type: 'phrase',
    description: '',
    aliasesText: '',
    category: 'other',
    pinned,
    meanings: [emptyMeaning()],
  };
}

export function cueEditorDraftFrom(cue: Cue): CueEditorDraft {
  return {
    id: cue.id,
    label: cue.label,
    cue_type: cue.cue_type,
    description: cue.description,
    aliasesText: cue.aliases.join(', '),
    category: cue.category,
    pinned: cue.pinned,
    meanings: cue.cue_meanings.length
      ? cue.cue_meanings.map((m) => ({
          key: nextKey(),
          id: m.id,
          context_tags: m.context_tags,
          context_text: m.context_text,
          meaning: m.meaning,
          what_to_do: m.what_to_do,
          what_to_avoid: m.what_to_avoid,
          confidence: m.confidence,
        }))
      : [emptyMeaning()],
  };
}

/** "cookie, Cookies ,, cooky" → ["cookie", "Cookies", "cooky"], without repeats, within database limits. */
export function parseAliases(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const alias = raw.trim().slice(0, 80);
    const key = alias.toLowerCase();
    if (alias && !seen.has(key)) {
      seen.add(key);
      out.push(alias);
    }
  }
  return out.slice(0, 20);
}

export function toMeaningInput(m: MeaningDraft): MeaningInput {
  return {
    ...(m.id ? { id: m.id } : {}),
    context_tags: m.context_tags,
    context_text: m.context_text.trim(),
    meaning: m.meaning.trim(),
    what_to_do: m.what_to_do.trim(),
    what_to_avoid: m.what_to_avoid.trim(),
    confidence: m.confidence,
  };
}

export function toCueInput(draft: CueEditorDraft): { cue: CueInput; meanings: MeaningInput[] } {
  return {
    cue: {
      ...(draft.id ? { id: draft.id } : {}),
      label: draft.label.trim(),
      cue_type: draft.cue_type,
      description: draft.description.trim(),
      aliases: parseAliases(draft.aliasesText),
      category: draft.category,
      pinned: draft.pinned,
    },
    meanings: draft.meanings.map(toMeaningInput),
  };
}

export interface CueErrors {
  label?: string;
  /** Keyed by meaning key. */
  meanings: Record<string, string>;
}

export function validateCueEditor(draft: CueEditorDraft): CueErrors {
  const meanings: Record<string, string> = {};
  for (const m of draft.meanings) {
    if (!m.meaning.trim()) meanings[m.key] = copy.cueForm.meaningMissing;
  }
  return { ...(draft.label.trim() ? {} : { label: copy.cueForm.labelMissing }), meanings };
}

export function hasErrors(errors: CueErrors): boolean {
  return Boolean(errors.label) || Object.keys(errors.meanings).length > 0;
}

/** Keeps chosen context tags in their standard order. */
export function toggleTag(tags: readonly ContextTag[], tag: ContextTag, all: readonly ContextTag[]): ContextTag[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : all.filter((t) => t === tag || tags.includes(t));
}

/**
 * A meaning built from a worker's note, for the family to confirm. What they tried becomes
 * "what to do" if it helped, or "what to avoid" if it didn't. One shift is one observation,
 * so it starts as "Sometimes".
 */
export function meaningDraftFromNote(note: ShiftNote): MeaningDraft {
  const helped = note.outcome !== 'no';
  return {
    key: nextKey(),
    context_tags: note.context_tags,
    context_text: note.context_text.slice(0, 120),
    meaning: note.seemed_to_need,
    what_to_do: helped ? note.tried : '',
    what_to_avoid: helped ? '' : note.tried,
    confidence: 'sometimes',
  };
}

/** A note can be added in one tap when it points at an existing cue and says what was needed. */
export function canAddInOneTap(note: ShiftNote, cues: readonly Cue[]): boolean {
  return Boolean(note.cue_id && cues.some((c) => c.id === note.cue_id) && note.seemed_to_need.trim());
}

/** The editor draft for confirming a note: the existing cue plus the note's meaning, or a new cue. */
export function cueEditorDraftFromNote(note: ShiftNote, cues: readonly Cue[]): CueEditorDraft {
  const existing = note.cue_id ? cues.find((c) => c.id === note.cue_id) : undefined;
  if (existing) {
    const draft = cueEditorDraftFrom(existing);
    return { ...draft, meanings: [...draft.meanings, meaningDraftFromNote(note)] };
  }
  return {
    label: note.cue_text.slice(0, 120),
    cue_type: 'other',
    description: '',
    aliasesText: '',
    category: 'other',
    pinned: false,
    meanings: [meaningDraftFromNote(note)],
  };
}
