import type { Cue, CueCategory } from '../data/types';

/**
 * Mirrors public.normalise_query(): lowercase, apostrophes removed, other punctuation to spaces,
 * spaces collapsed. "Cookie time!" → "cookie time". Both are tested against the same cases.
 */
export function normaliseQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cueHaystack(cue: Cue): string {
  return normaliseQuery(
    [
      cue.label,
      ...cue.aliases,
      cue.description,
      ...cue.cue_meanings.flatMap((m) => [m.meaning, m.what_to_do, m.what_to_avoid, m.context_text]),
    ].join(' '),
  );
}

/**
 * The family's own library filter: every word typed must appear somewhere in the cue.
 * (Workers use the ranked database search instead.)
 */
export function filterCues(cues: readonly Cue[], query: string, category: CueCategory | 'all'): Cue[] {
  const words = normaliseQuery(query).split(' ').filter(Boolean);
  return cues.filter((cue) => {
    if (category !== 'all' && cue.category !== category) return false;
    if (!words.length) return true;
    const hay = cueHaystack(cue);
    return words.every((w) => hay.includes(w));
  });
}
