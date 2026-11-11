import type { ContextTag, Cue } from '../data/types';
import { normaliseQuery } from '../lib/search';
import type { SearchHit, WorkerSource } from '../worker/types';
import { ARI_CUES, ARI_PROFILE, ARI_SECTIONS } from './ari';

/*
 * A simple in-browser stand-in for search_cues, for the demo only. Same tiers in the same order
 * and the same rules as supabase/migrations/20261111000100_search_relevance.sql, same context
 * ordering, up to 5 results, and nothing at all when nothing matches. Both are checked against
 * supabase/tests/search-cases.json. Two approximations: trigram similarity is worked out here the
 * way pg_trgm does it, and a crude suffix trim stands in for Postgres's english stemming.
 */

/** Postgres's english stop words. They never make a match on their own. */
const STOP_WORDS = new Set(
  ('i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers ' +
    'herself it its itself they them their theirs themselves what which who whom this that these those am is are ' +
    'was were be been being have has had having do does did doing a an the and but if or because as until while ' +
    'of at by for with about against between into through during before after above below to from up down in out ' +
    'on off over under again further then once here there when where why how all any both each few more most other ' +
    'some such no nor not only own same so than too very s t can will just don should now').split(' '),
);

const WHOLE_MATCH = 0.45;
const WORD_MATCH = 0.4;

function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text.split(' ').filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) set.add(padded.slice(i, i + 3));
  }
  return set;
}

/** pg_trgm's similarity(): shared trigrams over all trigrams, with words padded the same way. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const all = ta.size + tb.size - shared;
  return all === 0 ? 0 : shared / all;
}

const stem = (word: string) => word.replace(/(ing|ed|es|s|e)$/, '');

function tier(cue: Cue, q: string): number {
  const label = normaliseQuery(cue.label);
  const aliases = cue.aliases.map(normaliseQuery);
  if (label === q) return 4;
  if (aliases.includes(q)) return 3;
  const names = [label, ...aliases];
  if (names.some((n) => similarity(n, q) >= WHOLE_MATCH)) return 2;
  const content = q.split(' ').filter((w) => !STOP_WORDS.has(w));
  if (content.length === 0) return 0;
  const nameWords = names.flatMap((n) => n.split(' ')).filter(Boolean);
  const nameMatch = (w: string) =>
    nameWords.some(
      (n) => n === w || (w.length >= 3 && n.startsWith(w)) || (w.length >= 4 && n[0] === w[0] && similarity(w, n) >= WORD_MATCH),
    );
  if (content.every(nameMatch)) return 2;
  const text = normaliseQuery(
    [cue.label, ...cue.aliases, cue.description, ...cue.cue_meanings.map((m) => `${m.meaning} ${m.context_text}`)].join(' '),
  );
  const stems = new Set(text.split(' ').map(stem));
  if (content.every((w) => stems.has(stem(w)))) return 1;
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
