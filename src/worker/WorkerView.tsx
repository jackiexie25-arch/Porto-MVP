import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalmWave, WorkerPhone } from '../assets/illustrations';
import { FirstShiftCard } from '../components/card/FirstShiftCard';
import { Banner, Button, Card, ChipGroup, ChoiceChip, Sheet, Tag, Wordmark } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { contextPhrase, type CardModel } from '../lib/card';
import { friendlyError } from '../lib/errors';
import { normaliseQuery } from '../lib/search';
import { formatUntil } from '../lib/share';
import { usePageTitle } from '../lib/usePageTitle';
import { workerCard } from './toCard';
import type { SearchHit, WorkerCardData, WorkerSource } from './types';
import styles from './Worker.module.css';

const w = copy.worker;
const SEARCH_DELAY = 400;
const CONTEXTS = w.contexts as readonly ContextTag[];

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'results'; hits: SearchHit[] }
  | { kind: 'error'; message: string };

function readContext(): ContextTag | null {
  try {
    const value = sessionStorage.getItem('porto.context');
    return value && (CONTEXTS as readonly string[]).includes(value) ? (value as ContextTag) : null;
  } catch {
    return null;
  }
}

function saveContext(value: ContextTag | null) {
  try {
    if (value) sessionStorage.setItem('porto.context', value);
    else sessionStorage.removeItem('porto.context');
  } catch {
    // The choice still lasts for this page; it just won't survive a refresh.
  }
}

function Meaning({ m }: { m: SearchHit['meanings'][number] }) {
  const where = contextPhrase(m.context_tags, m.context_text);
  return (
    <div className={[styles.meaning, m.in_context ? styles.inContext : ''].join(' ')}>
      <p>
        {where ? <strong>{where}: </strong> : null}
        {m.meaning} <Tag tone="rose">{copy.labels.confidence[m.confidence]}</Tag>
      </p>
      {m.what_to_do ? (
        <p>
          <strong>{w.tryLabel}: </strong>
          {m.what_to_do}
        </p>
      ) : null}
      {m.what_to_avoid ? (
        <p>
          <strong>{w.avoidLabel}: </strong>
          {m.what_to_avoid}
        </p>
      ) : null}
    </div>
  );
}

function Result({ hit, onOpen }: { hit: SearchHit; onOpen: () => void }) {
  return (
    <Card as="li" className={styles.result}>
      <h3 className={styles.resultLabel}>{hit.label}</h3>
      {hit.meanings.map((m, i) => (
        <Meaning key={i} m={m} />
      ))}
      <div>
        <Button variant="secondary" onClick={onOpen} aria-label={w.biggerLabel(hit.label)}>
          {w.bigger}
        </Button>
      </div>
    </Card>
  );
}

function Shell({ name, expiresAt, demoNote, children }: { name: string; expiresAt?: string; demoNote?: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Wordmark width={88} />
        <div className={styles.headerText}>
          <p className={styles.sharedBy}>{w.sharedBy(name)}</p>
          {expiresAt ? <p className="t-small t-muted">{w.openUntil(formatUntil(expiresAt))}</p> : null}
        </div>
      </header>
      {demoNote}
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <p className="t-small t-muted">{w.privacy(name)}</p>
        <p className={styles.emergency}>{copy.layout.emergency}</p>
      </footer>
    </div>
  );
}

export function ClosedView({ name }: { name?: string }) {
  return (
    <div className={styles.page}>
      <main id="main" className={[styles.main, styles.closed].join(' ')}>
        <CalmWave className={styles.closedArt} />
        <h1 className="t-h2">{w.closedHeading}</h1>
        <p className="t-body-lg">{name ? w.closedBody(name) : w.closedBodyNoName}</p>
      </main>
    </div>
  );
}

function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.page}>
      <main id="main" className={styles.main}>
        <Banner tone="error">{message}</Banner>
        <div>
          <Button variant="outlined" onClick={onRetry}>
            {w.tryAgain}
          </Button>
        </div>
      </main>
    </div>
  );
}

/**
 * The worker's screen: search first, the card underneath. Shows only what the family wrote.
 * When nothing matches it says so and offers the family's calming advice; it never guesses.
 */
export function WorkerView({ source, demoNote }: { source: WorkerSource; demoNote?: ReactNode }) {
  usePageTitle(w.title);
  const [card, setCard] = useState<WorkerCardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'closed' | 'busy' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<ContextTag | null>(readContext);
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [open, setOpen] = useState<SearchHit | null>(null);
  const requestId = useRef(0);
  const inputId = useId();
  const hintId = useId();
  const contextId = useId();

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await source.getCard();
      if (result.status === 'ok') {
        setCard(result);
        setStatus('ok');
      } else {
        setStatus(result.status);
      }
    } catch (err) {
      setLoadError(friendlyError(err));
      setStatus('error');
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  const model: CardModel | null = useMemo(() => (card ? workerCard(card) : null), [card]);
  const canSearch = card?.scope !== 'card';
  const normalised = normaliseQuery(query);

  useEffect(() => {
    if (!card || !canSearch || !normalised) {
      setSearch({ kind: 'idle' });
      return;
    }
    const id = ++requestId.current;
    setSearch({ kind: 'searching' });
    const timer = setTimeout(async () => {
      try {
        const result = await source.search(query, context);
        if (id !== requestId.current) return;
        if (result.status === 'ok') setSearch({ kind: 'results', hits: result.results });
        else if (result.status === 'closed') setStatus('closed');
        else if (result.status === 'busy') setSearch({ kind: 'error', message: copy.common.tryAgainSoon });
        else setSearch({ kind: 'idle' });
      } catch (err) {
        if (id === requestId.current) setSearch({ kind: 'error', message: friendlyError(err) });
      }
    }, SEARCH_DELAY);
    return () => clearTimeout(timer);
    // Keyed on the normalised query: typing "cookie" then "cookie!" doesn't search (or log) twice.
  }, [normalised, context, card, canSearch, source]);

  if (status === 'closed') return <ClosedView name={model?.name} />;
  if (status === 'busy') return <Retry message={copy.common.tryAgainSoon} onRetry={() => void load()} />;
  if (status === 'error') return <Retry message={loadError} onRetry={() => void load()} />;
  if (status === 'loading' || !card || !model) {
    return (
      <div className={styles.page}>
        <main id="main" className={styles.main}>
          <p role="status" className="t-muted">
            {copy.common.loading}
          </p>
        </main>
      </div>
    );
  }

  const calms = model.sections.find((s) => s.key === 'calms')?.lines ?? [];

  return (
    <Shell name={model.name} expiresAt={card.expires_at} demoNote={demoNote}>
      {canSearch ? (
        <section className={styles.search} aria-label={w.searchLabel}>
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={inputId} className={styles.searchLabel}>
              {w.searchLabel}
            </label>
            <input
              id={inputId}
              type="search"
              className={styles.searchInput}
              aria-describedby={hintId}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              maxLength={200}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p id={hintId} className="t-small t-muted">
              {w.searchHint}
            </p>
          </form>

          <div className={styles.contexts}>
            <p id={contextId} className={styles.contextLegend}>
              {w.contextLegend}
            </p>
            <ChipGroup aria-labelledby={contextId}>
              {CONTEXTS.map((tag) => (
                <ChoiceChip
                  key={tag}
                  selected={context === tag}
                  onClick={() => {
                    const next = context === tag ? null : tag;
                    setContext(next);
                    saveContext(next);
                  }}
                >
                  {copy.labels.context[tag]}
                </ChoiceChip>
              ))}
            </ChipGroup>
          </div>

          <div aria-live="polite" className={styles.results}>
            {search.kind === 'idle' ? <WorkerPhone className={styles.idleArt} /> : null}
            {search.kind === 'searching' ? <p className="t-muted">{w.searching}</p> : null}
            {search.kind === 'error' ? <Banner tone="error">{search.message}</Banner> : null}
            {search.kind === 'results' && search.hits.length > 0 ? (
              <>
                <p className="t-small t-muted">{w.resultCount(search.hits.length)}</p>
                <ul className={styles.resultList}>
                  {search.hits.map((hit) => (
                    <Result key={hit.id} hit={hit} onOpen={() => setOpen(hit)} />
                  ))}
                </ul>
              </>
            ) : null}
            {search.kind === 'results' && search.hits.length === 0 ? (
              <Card className={styles.noMatch}>
                <p className="t-body-lg">
                  <strong>{w.noMatch(model.name)}</strong>
                </p>
                {calms.length ? (
                  <>
                    <p>{w.noMatchCalm}</p>
                    {calms.map((line) => (
                      <p key={line.text}>{line.text}</p>
                    ))}
                  </>
                ) : null}
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="worker-card" className={styles.card}>
        <h2 id="worker-card" className="t-h3">
          {w.cardHeading}
        </h2>
        <FirstShiftCard model={model} variant="worker" headingLevel={3} showEmergency={false} />
      </section>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.label ?? ''}>
        <div className={styles.bigger}>
          {open?.meanings.map((m, i) => (
            <Meaning key={i} m={m} />
          ))}
        </div>
      </Sheet>
    </Shell>
  );
}
