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
