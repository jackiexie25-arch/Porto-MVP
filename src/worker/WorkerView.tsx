import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CalmWave } from '../assets/illustrations';
import { CardOpening, FirstShiftCard, telHref } from '../components/card/FirstShiftCard';
import { MeaningView } from '../components/cues/MeaningView';
import { Banner, Button, ChipGroup, ChoiceChip, PhoneIcon, SearchField, Sheet, Wordmark } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import {
  cardMeaning,
  cardText,
  contextPhrase,
  countWords,
  isEmptyCard,
  readingMinutes,
  type CardModel,
} from '../lib/card';
import { friendlyError } from '../lib/errors';
import { normaliseQuery } from '../lib/search';
import { formatUntil } from '../lib/share';
import { usePageTitle } from '../lib/usePageTitle';
import { arrangeMeanings } from './arrange';
import { emptyLog, LogForm, type LogDraft } from './LogForm';
import { workerCard } from './toCard';
import type { SearchHit, WorkerCardData, WorkerSource } from './types';
import styles from './Worker.module.css';

const w = copy.worker;
const SEARCH_DELAY = 400;
const CONTEXTS = w.contexts as readonly ContextTag[];

type HitMeaning = SearchHit['meanings'][number];

/**
 * 'loading' is the first search, before there is anything to show. While the worker refines a
 * search, the last results stay on screen ('pending') so nothing jumps under their thumb.
 */
type SearchState =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'results'; hits: SearchHit[] } | { kind: 'error'; message: string };

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

type FeedbackState = 'sending' | 'done' | 'error';
type Helpful = boolean;

/** One quiet line under a result. After an answer it thanks the worker and offers a note. */
function Feedback({
  label,
  state,
  onAnswer,
  onNote,
}: {
  label: string;
  state?: FeedbackState;
  onAnswer: (helpful: Helpful) => void;
  onNote?: () => void;
}) {
  const thanksRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state === 'done') thanksRef.current?.focus();
  }, [state]);

  if (state === 'done') {
    return (
      <div className={styles.quietLine}>
        <p ref={thanksRef} tabIndex={-1} className={styles.thanks} role="status">
          {w.feedbackThanks}
        </p>
        {onNote ? (
          <button type="button" className={styles.textButton} onClick={onNote} aria-label={w.feedbackNoteLabel(label)}>
            {w.feedbackNote}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={styles.quietLine}>
      <p className={styles.quietLabel}>{w.feedbackQuestion}</p>
      <button
        type="button"
        className={styles.textButton}
        disabled={state === 'sending'}
        onClick={() => onAnswer(true)}
        aria-label={w.feedbackYesLabel(label)}
      >
        {w.feedbackYes}
      </button>
      <button
        type="button"
        className={styles.textButton}
        disabled={state === 'sending'}
        onClick={() => onAnswer(false)}
        aria-label={w.feedbackNoLabel(label)}
      >
        {w.feedbackNo}
      </button>
      {state === 'error' ? <p className={styles.quietLabel}>{copy.common.tryAgainSoon}</p> : null}
    </div>
  );
}

/** A result, set as the answer: the meaning for here leads; other places sit quieter beneath. */
function Result({
  hit,
  name,
  place,
  onOpen,
  feedback,
  onFeedback,
  onNote,
}: {
  hit: SearchHit;
  name: string;
  place: ContextTag | null;
  onOpen: () => void;
  feedback?: FeedbackState;
  onFeedback: (helpful: Helpful) => void;
  onNote?: () => void;
}) {
  const { lead, others, notice } = arrangeMeanings(hit.meanings, place);
  return (
    <li className={styles.result}>
      <h3 className={styles.resultLabel}>{hit.label}</h3>
      {notice === 'notHere' && place ? (
        <p className={styles.notice}>{w.notWrittenHere(name, copy.labels.contextPhrase[place])}</p>
      ) : null}
      {notice === 'choosePlace' ? <p className={styles.notice}>{w.choosePlace(name)}</p> : null}
      {lead.map((m, i) => (
        <MeaningView key={i} meaning={cardMeaning(m)} density="lead" inContext={place !== null} />
      ))}
      {others.length ? (
        <div className={styles.others}>
          {lead.length ? <p className={styles.othersLabel}>{w.otherPlaces}</p> : null}
          {others.map((m, i) => (
            <MeaningView key={i} meaning={cardMeaning(m)} density="compact" />
          ))}
        </div>
      ) : null}
      <div className={styles.resultActions}>
        <button type="button" className={styles.textButton} onClick={onOpen} aria-label={w.biggerLabel(hit.label)}>
          {w.bigger}
        </button>
        <Feedback label={hit.label} state={feedback} onAnswer={onFeedback} onNote={onNote} />
      </div>
    </li>
  );
}

/** "Show it large": the meaning for here at hero size, to hold out to a colleague. */
function Large({ hit, place }: { hit: SearchHit; place: ContextTag | null }) {
  const { lead, others } = arrangeMeanings(hit.meanings, place);
  const ordered: HitMeaning[] = [...lead, ...others];
  const [shown, setShown] = useState(0);
  const current = ordered[shown];
  if (!current) return null;
  const rest = ordered.map((m, i) => ({ m, i })).filter(({ i }) => i !== shown);
  return (
    <div className={styles.large}>
      <MeaningView meaning={cardMeaning(current)} density="large" />
      {rest.length ? (
        <div className={styles.largeOther}>
          <p className={styles.othersLabel}>{w.largeOther}</p>
          {rest.map(({ m, i }) => {
            const where = contextPhrase(m.context_tags, m.context_text) || copy.meaning.anywhere;
            return (
              <Button key={i} variant="outlined" onClick={() => setShown(i)} aria-label={w.largeOtherLabel(where)}>
                {where}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CallLink({ who }: { who: NonNullable<CardModel['whoToCall']> }) {
  return (
    <a href={telHref(who.phone)} className={styles.call} aria-label={w.callLabel(who.name, who.phone)}>
      <PhoneIcon size={20} />
      <span>{w.call(who.name)}</span>
    </a>
  );
}

function Shell({
  name,
  who,
  demoNote,
  children,
}: {
  name: string;
  who?: CardModel['whoToCall'];
  demoNote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={[styles.page, demoNote ? styles.withNote : ''].join(' ')}>
      <a className="skip-link" href="#main">
        {copy.layout.skipLink}
      </a>
      <header className={styles.masthead}>
        <Wordmark width={88} />
        {who ? <CallLink who={who} /> : null}
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
      <a className="skip-link" href="#main">
        {copy.layout.skipLink}
      </a>
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

/** While the card loads: the page's frame, so nothing jumps when it arrives. */
function Opening() {
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Wordmark width={88} />
      </header>
      <main id="main" className={styles.main}>
        <div className={styles.intro}>
          <p role="status" className={styles.openingLine}>
            {w.opening}
          </p>
        </div>
      </main>
    </div>
  );
}

function wantsScroll(): boolean {
  // On a wide screen the search sits beside the card, so there is nothing to bring into view.
  return !(typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 960px)').matches);
}

/**
 * The worker's screen: who this is and who to call, the family's note, search, then the card.
 * Shows only what the family wrote. When nothing matches it says so and offers the family's
 * calming advice; it never guesses.
 */
export function WorkerView({ source, demoNote }: { source: WorkerSource; demoNote?: ReactNode }) {
  usePageTitle(w.title);
  const [card, setCard] = useState<WorkerCardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'closed' | 'busy' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<ContextTag | null>(readContext);
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState<SearchHit | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { state: FeedbackState; helpful: Helpful }>>({});
  const [log, setLog] = useState<{ key: number; draft: LogDraft } | null>(null);
  const requestId = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const placeId = useId();
  const quickId = useId();

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

  async function sendFeedback(cueId: string, helpful: Helpful) {
    setFeedback((f) => ({ ...f, [cueId]: { state: 'sending', helpful } }));
    try {
      const result = await source.feedback(cueId, helpful);
      if (result.status === 'closed') return setStatus('closed');
      setFeedback((f) => ({
        ...f,
        [cueId]: { state: result.status === 'ok' ? 'done' : 'error', helpful },
      }));
    } catch {
      setFeedback((f) => ({ ...f, [cueId]: { state: 'error', helpful } }));
    }
  }

  function openLog(draft: Partial<LogDraft> = {}) {
    setLog({ key: Date.now(), draft: { ...emptyLog('', context), ...draft } });
  }

  /** A note about the cue the worker is reading, with what they already told us filled in. */
  function noteAbout(hit: SearchHit) {
    const answer = feedback[hit.id];
    openLog({
      ...(cueIds.has(hit.id) ? { cueId: hit.id } : { cueText: hit.label }),
      ...(answer ? { outcome: answer.helpful ? 'worked' : 'no' } : {}),
    });
  }

  const normalised = normaliseQuery(query);
  const hasQuery = normalised !== '';

  // Bring the search box to the top of the screen when the worker starts, so the answer sits
  // above the keyboard. Only on the first character, never while they type.
  useEffect(() => {
    if (hasQuery && wantsScroll()) formRef.current?.scrollIntoView?.({ block: 'start' });
  }, [hasQuery]);

  useEffect(() => {
    if (!card || !canSearch || !normalised) {
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
        const result = await source.search(query, context);
        if (id !== requestId.current) return;
        setPending(false);
        if (result.status === 'ok') setSearch({ kind: 'results', hits: result.results });
        else if (result.status === 'closed') setStatus('closed');
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
    // Keyed on the normalised query: typing "cookie" then "cookie!" doesn't search (or log) twice.
  }, [normalised, context, card, canSearch, source]);

  if (status === 'closed') return <ClosedView name={model?.name} />;
  if (status === 'busy') return <Retry message={copy.common.tryAgainSoon} onRetry={() => void load()} />;
  if (status === 'error') return <Retry message={loadError} onRetry={() => void load()} />;
  if (status === 'loading' || !card || !model) return <Opening />;

  const name = model.name;
  const calms = model.sections.find((s) => s.key === 'calms')?.lines ?? [];
  const minutes = readingMinutes(countWords(cardText(model)));
  const noMatch = search.kind === 'results' && search.hits.length === 0;
  const empty = isEmptyCard(model);

  let statusText = '';
  if (search.kind === 'results') statusText = w.resultCount(search.hits.length, name);
  const shownStatus = pending ? (search.kind === 'results' ? w.updating : w.searching(name)) : statusText;

  return (
    <Shell name={name} who={model.whoToCall} demoNote={demoNote}>
      <section className={styles.intro} aria-labelledby="worker-name">
        <h1 id="worker-name" className={styles.name}>
          {name}
        </h1>
        <p className={styles.byline}>
          {w.sharedBy(name)}
          <span className={styles.until}>{w.openUntil(formatUntil(card.expires_at))}</span>
        </p>
        <CardOpening model={model} className={styles.opening} />
      </section>

      {canSearch ? (
        <div className={styles.search}>
          <ChipGroup aria-labelledby={placeId} className={styles.place}>
            <span id={placeId} className={styles.placeLead}>
              {w.placeLead}
              <span className="visually-hidden"> ({w.placeLegend})</span>
            </span>
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

          <form ref={formRef} role="search" className={styles.form} onSubmit={(e) => e.preventDefault()}>
            {/* Once they are typing, the hint gives its room to the answer above the keyboard. */}
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

          {/* Announces only a short status (a count, or "nothing matches"), never every result. */}
          <p role="status" aria-live="polite" className={shownStatus ? styles.status : 'visually-hidden'}>
            {shownStatus}
          </p>

          {search.kind === 'idle' && model.cues.length ? (
            <div className={styles.quick}>
              <p id={quickId} className={styles.quickHeading}>
                {w.quickHeading(name)}
              </p>
              <ul className={styles.quickList} aria-labelledby={quickId}>
                {model.cues.map((cue) => (
                  <li key={cue.id}>
                    <button type="button" className={styles.quickButton} onClick={() => setQuery(cue.label)}>
                      {cue.label}
                    </button>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>{w.quickHint}</p>
            </div>
          ) : null}

          {search.kind === 'loading' ? <div className={styles.loadingFrame} aria-hidden="true" /> : null}
          {search.kind === 'error' ? <Banner tone="error">{search.message}</Banner> : null}

          {search.kind === 'results' && search.hits.length > 0 ? (
            <ul className={[styles.answer, styles.resultList].join(' ')}>
              {search.hits.map((hit) => (
                <Result
                  key={hit.id}
                  hit={hit}
                  name={name}
                  place={context}
                  onOpen={() => setOpen(hit)}
                  feedback={feedback[hit.id]?.state}
                  onFeedback={(helpful) => void sendFeedback(hit.id, helpful)}
                  onNote={canLog ? () => noteAbout(hit) : undefined}
                />
              ))}
            </ul>
          ) : null}

          {noMatch ? (
            <div className={[styles.answer, styles.noMatch].join(' ')}>
              <p className={styles.noMatchHeading}>{w.noMatch(name)}</p>
              {calms.length ? (
                <div className={styles.calm}>
                  <p className={styles.othersLabel}>{w.noMatchCalm}</p>
                  {calms.map((line) => (
                    <p key={line.text} className={styles.calmText}>
                      {line.text}
                    </p>
                  ))}
                </div>
              ) : null}
              {canLog ? (
                <div>
                  <Button variant="outlined" onClick={() => openLog({ cueText: query.trim() })}>
                    {w.tellFamily(name)}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {canLog && !noMatch ? (
            <div className={styles.logLine}>
              <p>{w.logPrompt(name)}</p>
              <button type="button" className={styles.textButton} onClick={() => openLog()}>
                {w.logOpen}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="worker-card" className={styles.card}>
        <div className={styles.cardHead}>
          <h2 id="worker-card" className={styles.cardHeading}>
            {w.cardHeading(name)}
          </h2>
          {!empty ? <p className={styles.hint}>{w.readTime(minutes)}</p> : null}
        </div>
        {empty ? (
          <p>{w.emptyCard(name)}</p>
        ) : (
          <FirstShiftCard model={model} variant="worker" headingLevel={3} showEmergency={false} showOpening={false} />
        )}
      </section>

      <Sheet open={log !== null} onClose={() => setLog(null)} title={w.log.title}>
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

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open?.label ?? ''}>
        {open ? <Large key={open.id} hit={open} place={context} /> : null}
      </Sheet>
    </Shell>
  );
}
