import { useEffect, useRef, useState } from 'react';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { friendlyError } from '../lib/errors';
import { normaliseQuery } from '../lib/search';
import type { SearchHit, WorkerSource } from './types';

export const SEARCH_DELAY = 400;

/**
 * 'loading' is the first search, before there is anything to show. While the worker refines a
 * search, the last results stay on screen (`pending`) so nothing jumps under their thumb.
 */
export type SearchState =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'results'; hits: SearchHit[] } | { kind: 'error'; message: string };

/**
 * Searches the family's cues as the worker types. Keyed on the normalised query, so typing
 * "cookie" then "cookie!" doesn't search (or log) twice. Only the latest answer is shown.
 */
export function useWorkerSearch({
  source,
  query,
  place,
  enabled,
  onClosed,
}: {
  source: WorkerSource;
  query: string;
  place: ContextTag | null;
  enabled: boolean;
  onClosed: () => void;
}) {
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const latest = useRef({ query, onClosed });
  latest.current = { query, onClosed };
  const normalised = normaliseQuery(query);

  useEffect(() => {
    if (!enabled || !normalised) {
      requestId.current += 1;
      setSearch({ kind: 'idle' });
      setPending(false);
      return;
    }
    const id = ++requestId.current;
    setPending(true);
    setSearch((s) => (s.kind === 'results' ? s : { kind: 'loading' }));
    const timer = setTimeout(async () => {
      try {
        const result = await source.search(latest.current.query, place);
        if (id !== requestId.current) return;
        setPending(false);
        if (result.status === 'ok') setSearch({ kind: 'results', hits: result.results });
        else if (result.status === 'closed') latest.current.onClosed();
        else if (result.status === 'busy') setSearch({ kind: 'error', message: copy.common.tryAgainSoon });
        else setSearch({ kind: 'idle' });
      } catch (err) {
        if (id === requestId.current) {
          setPending(false);
          setSearch({ kind: 'error', message: friendlyError(err) });
        }
      }
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [normalised, place, enabled, source]);

  return { search, pending, hasQuery: normalised !== '' };
}
