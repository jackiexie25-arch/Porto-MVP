import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { FirstShiftCard } from '../components/card/FirstShiftCard';
import { Banner, ChipGroup, ChoiceChip, SearchField, Sheet } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { cardText, countWords, isEmptyCard, readingMinutes, type CardModel } from '../lib/card';
import { friendlyError } from '../lib/errors';
import { usePageTitle } from '../lib/usePageTitle';
import { LargeView } from './LargeView';
import { landingDelta } from './landing';
import { emptyLog, LogForm, type LogDraft } from './LogForm';
import { NoMatch } from './NoMatch';
import { CONTEXTS, placeLine, readContext, saveContext } from './place';
import { QuickCues } from './QuickCues';
import { workerCard } from './toCard';
import type { SearchHit, WorkerCardData, WorkerSource } from './types';
import { useWorkerSearch } from './useWorkerSearch';
import { WorkerIntro } from './WorkerIntro';
import { WorkerResult, type FeedbackState } from './WorkerResult';
import { ClosedView, Opening, Retry, Shell } from './WorkerShell';
import styles from './Worker.module.css';

export { ClosedView } from './WorkerShell';

const w = copy.worker;

function isWide(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 960px)').matches;
}

/**
 * The worker's screen. Before you start: who this is, who to call, the family's note and the card.
 * Right now: where you are, the search and the answer. Shows only what the family wrote; when
 * nothing matches it says so and offers the family's calming advice. It never guesses.
 */
export function WorkerView({ source, demoNote }: { source: WorkerSource; demoNote?: ReactNode }) {
  usePageTitle(w.title);
  const [card, setCard] = useState<WorkerCardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'closed' | 'busy' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<ContextTag | null>(readContext);
  const [open, setOpen] = useState<SearchHit | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { state: FeedbackState; helpful: boolean }>>({});
  const [log, setLog] = useState<{ key: number; draft: LogDraft } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const answerAreaRef = useRef<HTMLDivElement>(null);
  const [returnY, setReturnY] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLElement | null>(null);
  const setAnswer = useCallback((el: HTMLElement | null) => {
    answerRef.current = el;
  }, []);
  const focusAnswer = useRef(false);
  const placeId = useId();

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
  const canLog = card?.scope === 'card_search_log';
  const cueIds = useMemo(() => new Set((card?.cue_options ?? []).map((c) => c.id)), [card]);
  const onClosed = useCallback(() => setStatus('closed'), []);
  const { search, pending, hasQuery } = useWorkerSearch({ source, query, place, enabled: Boolean(card) && canSearch, onClosed });

  // When the worker starts typing on a phone, bring the search box to the top of the screen so the
  // answer sits above the keyboard. Clearing the search forgets where to go back to.
  useEffect(() => {
    if (!hasQuery) {
      setReturnY(null);
      return;
    }
    if (!isWide()) formRef.current?.querySelector('input')?.scrollIntoView?.({ block: 'start' });
  }, [hasQuery]);

  // On a wide screen the search stays pinned while the card scrolls. When an answer arrives out of
  // sight, land it just under the pinned search, and offer a way back to where they were reading.
  useEffect(() => {
    if (search.kind !== 'results' || pending || !isWide()) return;
    const area = answerAreaRef.current?.getBoundingClientRect();
    const bar = barRef.current?.getBoundingClientRect();
    if (!area || !bar) return;
    const delta = landingDelta(area.top, bar.bottom, window.innerHeight);
    if (delta === null) return;
    const from = window.scrollY;
    setReturnY((y) => y ?? from);
    window.scrollBy?.({ top: delta });
  }, [search, pending]);

  // After a quick cue, focus moves to the answer (the button that was tapped has gone).
  useEffect(() => {
    if (focusAnswer.current && !pending && search.kind === 'results') {
      focusAnswer.current = false;
      answerRef.current?.focus();
    }
  }, [search, pending]);

  if (status === 'closed') return <ClosedView name={model?.name} />;
  if (status === 'busy') return <Retry message={copy.common.tryAgainSoon} onRetry={() => void load()} />;
  if (status === 'error') return <Retry message={loadError} onRetry={() => void load()} />;
  if (status === 'loading' || !card || !model) return <Opening />;

  const name = model.name;
  const empty = isEmptyCard(model);
  const calms = model.sections.find((s) => s.key === 'calms')?.lines ?? [];
  const hits = search.kind === 'results' ? search.hits : null;
  const noMatch = hits !== null && hits.length === 0;
  const count = pending ? (hits ? w.updating : w.searching(name)) : hits ? w.resultCount(hits.length) : '';

  function choosePlace(tag: ContextTag) {
    const next = place === tag ? null : tag;
    setPlace(next);
    saveContext(next);
  }

  function focusPlace() {
    const chips = chipsRef.current;
    (chips?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? chips?.querySelector<HTMLElement>('button'))?.focus();
  }

  function focusSearch() {
    const input = formRef.current?.querySelector('input');
    input?.focus();
    input?.scrollIntoView?.({ block: 'start' });
  }

  async function sendFeedback(cueId: string, helpful: boolean) {
    setFeedback((f) => ({ ...f, [cueId]: { state: 'sending', helpful } }));
    try {
      const result = await source.feedback(cueId, helpful);
      if (result.status === 'closed') return setStatus('closed');
      setFeedback((f) => ({ ...f, [cueId]: { state: result.status === 'ok' ? 'done' : 'error', helpful } }));
    } catch {
      setFeedback((f) => ({ ...f, [cueId]: { state: 'error', helpful } }));
    }
  }

  function openLog(draft: Partial<LogDraft> = {}) {
    setLog({ key: Date.now(), draft: { ...emptyLog('', place), ...draft } });
  }

  /** A note about the cue being read, with the cue and the worker's answer filled in. */
  function noteAbout(hit: SearchHit) {
    const answer = feedback[hit.id];
    openLog({
      ...(cueIds.has(hit.id) ? { cueId: hit.id } : { cueText: hit.label }),
      ...(answer ? { outcome: answer.helpful ? 'worked' : 'no' } : {}),
    });
  }

  return (
    <Shell name={name} demoNote={demoNote} onSkipToSearch={canSearch ? focusSearch : undefined}>
      <WorkerIntro
        model={model}
        expiresAt={card.expires_at}
        minutes={empty ? null : readingMinutes(countWords(cardText(model)))}
      />

      {canSearch ? (
        <section id="right-now" className={styles.now} aria-labelledby="right-now-heading">
          <div ref={barRef} className={styles.searchBar}>
            <h2 id="right-now-heading" className={styles.kicker}>
              {w.nowHeading}
            </h2>
            {/* "I'm at" with the chips hanging beside it, so a second row lines up after the words. */}
            <div ref={chipsRef} className={styles.places}>
              <span id={placeId} className={styles.placeLead}>
                {w.placeLead}
                <span className="visually-hidden"> ({w.placeLegend})</span>
              </span>
              <ChipGroup aria-labelledby={placeId} className={styles.placeChips}>
                {CONTEXTS.map((tag) => (
                  <ChoiceChip key={tag} selected={place === tag} onClick={() => choosePlace(tag)}>
                    {copy.labels.context[tag]}
                  </ChoiceChip>
                ))}
              </ChipGroup>
            </div>
            <form ref={formRef} role="search" className={styles.form} onSubmit={(e) => e.preventDefault()}>
              <SearchField
                size="large"
                label={w.searchLabel(name)}
                hint={query ? undefined : w.searchHint}
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={200}
                value={query}
                onValueChange={setQuery}
              />
            </form>
            <div className={hasQuery ? styles.statusRow : 'visually-hidden'}>
              {/* Announces only the count, never every result. */}
              <p role="status" aria-live="polite" className={styles.status}>
                {count}
              </p>
              {hasQuery ? (
                <>
                  {/* Each separator travels with the item after it, so a wrapped line never ends on a dot. */}
                  <span className={styles.statusItem}>
                    <span aria-hidden="true">·</span>
                    <span className={styles.status}>{place ? placeLine(place) : w.noPlace}</span>
                  </span>
                  <span className={styles.statusItem}>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={focusPlace}
                      aria-label={place ? w.changeLabel : w.chooseLabel}
                    >
                      {place ? w.change : w.choose}
                    </button>
                  </span>
                  {returnY !== null ? (
                    // A different kind of action from the count and place, so it takes its own line, with no dot.
                    <span className={styles.statusBack}>
                      <button
                        type="button"
                        className={styles.textButton}
                        aria-label={w.backToCardLabel}
                        onClick={() => {
                          window.scrollTo?.({ top: returnY });
                          setReturnY(null);
                        }}
                      >
                        {w.backToCard}
                      </button>
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div ref={answerAreaRef} className={styles.answerArea}>
            {search.kind === 'idle' ? (
              <QuickCues
                name={name}
                cues={model.cues}
                onPick={(label) => {
                  focusAnswer.current = true;
                  setQuery(label);
                }}
              />
            ) : null}
            {search.kind === 'loading' ? <div className={styles.loadingFrame} aria-hidden="true" /> : null}
            {search.kind === 'error' ? <Banner tone="error">{search.message}</Banner> : null}

            {hits && hits.length ? (
              <ul className={[styles.answer, styles.resultList].join(' ')}>
                {hits.map((hit, i) => (
                  <WorkerResult
                    key={hit.id}
                    hit={hit}
                    name={name}
                    place={place}
                    headingRef={i === 0 ? setAnswer : undefined}
                    onOpen={() => setOpen(hit)}
                    feedback={feedback[hit.id]?.state}
                    onFeedback={(helpful) => void sendFeedback(hit.id, helpful)}
                    onNote={canLog ? () => noteAbout(hit) : undefined}
                  />
                ))}
              </ul>
            ) : null}

            {noMatch ? (
              <NoMatch
                name={name}
                calms={calms}
                headingRef={setAnswer}
                onTell={canLog ? () => openLog({ cueText: query.trim() }) : undefined}
              />
            ) : null}
          </div>

          {canLog && !noMatch ? (
            <div className={styles.logLine}>
              <p>{w.logPrompt}</p>
              <button type="button" className={styles.textButton} onClick={() => openLog()}>
                {w.tellFamily(name)}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="worker-card" className={styles.card}>
        <h2 id="worker-card" tabIndex={-1} className={styles.cardHeading}>
          {w.cardHeading(name)}
        </h2>
        {empty ? (
          <p>{w.emptyCard(name)}</p>
        ) : (
          <FirstShiftCard model={model} variant="worker" headingLevel={3} showEmergency={false} showOpening={false} />
        )}
      </section>

      <Sheet open={log !== null} onClose={() => setLog(null)} title={w.log.title(name)}>
        {log ? (
          <LogForm
            key={log.key}
            name={name}
            source={source}
            cueOptions={card.cue_options ?? []}
            contexts={CONTEXTS}
            initial={log.draft}
            onClosed={() => {
              setLog(null);
              setStatus('closed');
            }}
          />
        ) : null}
      </Sheet>

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.label ?? ''} size="full">
        {open ? <LargeView key={open.id} hit={open} place={place} /> : null}
      </Sheet>
    </Shell>
  );
}
