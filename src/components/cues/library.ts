import type { CueInput, MeaningInput } from '../../data/family';
import type { ContextTag, Cue, CueMeaning } from '../../data/types';
import { pinnedCues } from '../../lib/card';
import { arrangeMeanings, type Arranged } from '../../worker/arrange';

export interface LibraryGroups {
  /** On the first-shift card, in the order workers see them. */
  onCard: Cue[];
  /** Everything else, A to Z, so a cue is where you expect it. */
  others: Cue[];
}

/** Splits the (already filtered) cues into the card's cues and the rest. */
export function groupForLibrary(cues: readonly Cue[]): LibraryGroups {
  const onCard = pinnedCues(cues);
  const pinnedIds = new Set(onCard.map((c) => c.id));
  const others = cues
    .filter((c) => !pinnedIds.has(c.id))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-AU', { sensitivity: 'base' }));
  return { onCard, others };
}

export type PlacedCueMeaning = CueMeaning & { in_context: boolean };

/**
 * A cue's meanings arranged exactly as a worker who chose `place` sees them in search
 * (see arrangeMeanings in the worker view). Only rearranges what the family wrote.
 */
export function asWorkerSees(cue: Cue, place: ContextTag | null): Arranged<PlacedCueMeaning> {
  const placed = cue.cue_meanings.map((m) => ({ ...m, in_context: place !== null && m.context_tags.includes(place) }));
  return arrangeMeanings(placed, place);
}

/** Plain facts about what isn't written yet. Never a judgement, never a guess. */
export function lacksWhatToDo(m: { what_to_do: string }): boolean {
  return !m.what_to_do.trim();
}

/** The same cue, saved with only its pin changed. Meaning ids are kept, so nothing else moves. */
export function withPin(cue: Cue, pinned: boolean): { cue: CueInput; meanings: MeaningInput[] } {
  return {
    cue: {
      id: cue.id,
      label: cue.label,
      cue_type: cue.cue_type,
      description: cue.description,
      aliases: cue.aliases,
      category: cue.category,
      pinned,
    },
    meanings: cue.cue_meanings.map((m) => ({
      id: m.id,
      context_tags: m.context_tags,
      context_text: m.context_text,
      meaning: m.meaning,
      what_to_do: m.what_to_do,
      what_to_avoid: m.what_to_avoid,
      confidence: m.confidence,
    })),
  };
}

/** The places a worker picks that a cue can be "not written for". Mealtime is a moment, not a place. */
export const PLACE_TAGS = ['home', 'school', 'camp', 'community'] as const satisfies readonly ContextTag[];

/** A meaning with no place or person named holds anywhere. */
export function isAnywhere(m: Pick<CueMeaning, 'context_tags' | 'context_text'>): boolean {
  return m.context_tags.length === 0 && !m.context_text.trim();
}

/**
 * Whether a worker who chose `place` finds something the family wrote for there, or for anywhere.
 * A plain fact, never a guess.
 */
export function coversPlace(cue: Pick<Cue, 'cue_meanings'>, place: ContextTag): boolean {
  return cue.cue_meanings.some((m) => isAnywhere(m) || m.context_tags.includes(place));
}

/** The worker places this cue has nothing written for, in order. None when a meaning holds anywhere. */
export function missingPlaces(cue: Pick<Cue, 'cue_meanings'>): ContextTag[] {
  if (!cue.cue_meanings.length) return [];
  return PLACE_TAGS.filter((p) => !coversPlace(cue, p));
}

/** With a place chosen: the cues with nothing written for there come first, so the gaps are the list. */
export function splitForPlace(cues: readonly Cue[], place: ContextTag): { gaps: Cue[]; written: Cue[] } {
  return {
    gaps: cues.filter((c) => !coversPlace(c, place)),
    written: cues.filter((c) => coversPlace(c, place)),
  };
}

/**
 * How many cues will be on the card after this cue's save: the others already there, minus one
 * being swapped off, plus this one if ticked. Never more than the card holds.
 */
export function cardCountAfter(pinnedElsewhere: number, pinned: boolean, swappingOff: boolean): number {
  return pinnedElsewhere - (swappingOff ? 1 : 0) + (pinned ? 1 : 0);
}
