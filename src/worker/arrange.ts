import type { ContextTag } from '../data/types';

interface PlacedMeaning {
  context_tags: readonly ContextTag[];
  context_text: string;
  in_context: boolean;
}

export interface Arranged<M> {
  /** Shown first, at full size. */
  lead: M[];
  /** Shown under "In other places", one step quieter. Never hidden: the worker may be wrong about the place. */
  others: M[];
  /**
   * 'notHere': a place is chosen and the family wrote nothing for it (or for anywhere).
   * 'choosePlace': no place is chosen and the family wrote different meanings for different places.
   */
  notice: 'none' | 'notHere' | 'choosePlace';
}

const placeKey = (m: PlacedMeaning) => [...m.context_tags].sort().join(',') + '|' + m.context_text.trim().toLowerCase();
const isAnywhere = (m: PlacedMeaning) => m.context_tags.length === 0 && !m.context_text.trim();

/**
 * Orders a cue's meanings for where the worker is. Only rearranges what the family wrote:
 * the meaning for this place leads; a meaning written for no particular place applies anywhere;
 * and when neither exists it says so instead of picking one.
 */
export function arrangeMeanings<M extends PlacedMeaning>(meanings: readonly M[], place: ContextTag | null): Arranged<M> {
  if (!place) {
    const differs = new Set(meanings.map(placeKey)).size > 1;
    return { lead: [...meanings], others: [], notice: differs ? 'choosePlace' : 'none' };
  }
  const here = meanings.filter((m) => m.in_context);
  const lead = here.length ? here : meanings.filter(isAnywhere);
  if (!lead.length) return { lead: [], others: [...meanings], notice: 'notHere' };
  return { lead, others: meanings.filter((m) => !lead.includes(m)), notice: 'none' };
}
