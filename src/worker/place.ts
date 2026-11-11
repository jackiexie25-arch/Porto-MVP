import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { contextPhrase } from '../lib/card';

export const CONTEXTS = copy.worker.contexts as readonly ContextTag[];
const KEY = 'porto.context';

/** The worker's "I'm at" choice lasts for this tab, so a refresh keeps it. */
export function readContext(): ContextTag | null {
  try {
    const value = sessionStorage.getItem(KEY);
    return value && (CONTEXTS as readonly string[]).includes(value) ? (value as ContextTag) : null;
  } catch {
    return null;
  }
}

export function saveContext(value: ContextTag | null) {
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    // The choice still lasts for this page; it just won't survive a refresh.
  }
}

/** "At school", "Out and about": the place as it reads at the start of a line. */
export function placeLine(place: ContextTag): string {
  return contextPhrase([place], '');
}
