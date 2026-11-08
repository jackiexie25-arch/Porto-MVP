import type { ContextTag, Cue } from '../data/types';
import { normaliseQuery } from '../lib/search';
import type { SearchHit, WorkerSource } from '../worker/types';
import { ARI_CUES, ARI_PROFILE, ARI_SECTIONS } from './ari';

/**
 * A simple in-browser stand-in for search_cues, for the demo only. Same tiers in the same order
 * (exact label, exact alias, close match, words in the meanings), same context ordering,
 * up to 5 results, and nothing at all when nothing matches. Close matching uses word prefixes
 * rather than trigrams, which is enough for a fictional profile of 8 cues.
 */
function tier(cue: Cue, q: string): number {
  const label = normaliseQuery(cue.label);
  const aliases = cue.aliases.map(normaliseQuery);
  if (label === q) return 4;
  if (aliases.includes(q)) return 3;
  const words = q.split(' ');
  const names = [label, ...aliases];
  const nameWords = names.flatMap((n) => n.split(' '));
  if (names.some((n) => n.includes(q)) || words.every((w) => nameWords.some((n) => n.startsWith(w)))) return 2;
  const text = normaliseQuery([cue.description, ...cue.cue_meanings.map((m) => `${m.meaning} ${m.context_text}`)].join(' '));
  if (words.every((w) => text.split(' ').some((t) => t.startsWith(w)))) return 1;
  return 0;
}

export function demoSearch(cues: readonly Cue[], query: string, context: ContextTag | null): SearchHit[] {
  const q = normaliseQuery(query.slice(0, 200));
  if (!q) return [];
  const inContext = (c: Cue) => (context ? c.cue_meanings.some((m) => m.context_tags.includes(context)) : false);
  return cues
    .map((cue) => ({ cue, tier: tier(cue, q) }))
    .filter((x) => x.tier > 0)
    .sort((a, b) => b.tier - a.tier || Number(inContext(b.cue)) - Number(inContext(a.cue)) || a.cue.label.localeCompare(b.cue.label))
    .slice(0, 5)
    .map(({ cue, tier: t }) => ({
      id: cue.id,
      label: cue.label,
      cue_type: cue.cue_type,
      category: cue.category,
      match: t === 4 ? 'label' : t === 3 ? 'alias' : t === 2 ? 'similar' : 'meaning',
      meanings: cue.cue_meanings
        .map((m) => ({
          context_tags: m.context_tags,
          context_text: m.context_text,
          meaning: m.meaning,
          what_to_do: m.what_to_do,
          what_to_avoid: m.what_to_avoid,
          confidence: m.confidence,
          in_context: context !== null && m.context_tags.includes(context),
        }))
        .sort((a, b) => Number(b.in_context) - Number(a.in_context)),
    }));
}

/** The demo never sends anything: notes and feedback are acknowledged and dropped. */
export function demoSource(): WorkerSource {
  return {
    getCard: async () => ({
      status: 'ok',
      scope: 'card_search_log',
      expires_at: new Date(Date.now() + 8 * 3_600_000).toISOString(),
      profile: ARI_PROFILE,
      sections: ARI_SECTIONS,
      cues: ARI_CUES.filter((c) => c.pinned),
      cue_options: ARI_CUES.map((c) => ({ id: c.id, label: c.label })),
    }),
    search: async (query, context) => ({ status: 'ok', results: demoSearch(ARI_CUES, query, context) }),
    logNote: async () => ({ status: 'ok' }),
    feedback: async () => ({ status: 'ok' }),
  };
}
