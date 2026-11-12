import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WorkerPhone } from '../../assets/illustrations';
import { CardSwapSheet } from '../../components/cues/CardSwapSheet';
import {
  asWorkerSees,
  groupForLibrary,
  lacksWhatToDo,
  missingPlaces,
  sortByLabel,
  splitForPlace,
  withPin,
} from '../../components/cues/library';
import { placeTitle } from '../../components/cues/MeaningSection';
import { PlacePicker } from '../../components/cues/PlacePicker';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, ButtonLink, SearchField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { ContextTag, Cue, CueMeaning } from '../../data/types';
import { MAX_PINNED, useFamilyData } from '../../family/FamilyDataProvider';
import { joinList, pinnedCues } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { filterCues } from '../../lib/search';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cues;
const WIDE = '(min-width: 1024px)';

/** Desktop keeps the card in the side column, so the index can run A to Z without repeating it. */
function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return wide;
}

function placeNames(places: readonly ContextTag[]): string {
  return joinList(
    places.map((p) => copy.labels.context[p].toLowerCase()),
    'or',
  );
}

/**
 * Each meaning as a line pair, place first ("At school · usually", then "I need a break"). Each pair
 * opens the editor on that meaning, so fixing one meaning is one tap away.
 */
function MeaningLines({ cue, meanings }: { cue: Cue; meanings: readonly CueMeaning[] }) {
  return (
    <ul className={styles.lines}>
      {meanings.map((m) => (
        <li key={m.id}>
          <Link to={`/cues/${cue.id}#meaning-${m.id}`} className={styles.line}>
            <span className={styles.where}>
              {copy.meaning.contextLine(placeTitle(m), copy.labels.confidenceInline[m.confidence])}
            </span>
            <span className={styles.says}>{m.meaning}</span>
            {lacksWhatToDo(m) ? <span className={styles.fact}>{c.missingDo}</span> : null}
            <span className="visually-hidden">, {cue.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type RowMode = { kind: 'all' } | { kind: 'written'; place: ContextTag } | { kind: 'gap'; place: ContextTag };

/** "Add to card" / "Take off card": a quiet 48px text button. */
function PinButton({ cue, busy, onPin, short = false }: { cue: Cue; busy: boolean; onPin: (cue: Cue) => void; short?: boolean }) {
  return (
    <button
      type="button"
      data-pin={cue.id}
      className={styles.pin}
      disabled={busy}
      onClick={() => onPin(cue)}
      aria-label={cue.pinned ? c.pinRemoveLabel(cue.label) : c.pinAddLabel(cue.label)}
    >
      {cue.pinned ? (short ? c.takeOff : c.pinRemove) : c.pinAdd}
    </button>
  );
}

function CueRow({
  cue,
  mode,
  busy,
  onPin,
  cardInSidebar,
}: {
  cue: Cue;
  mode: RowMode;
  busy: boolean;
  onPin: (cue: Cue) => void;
  /** Desktop: the card is managed in the side column, so a pinned row only states the fact. */
  cardInSidebar: boolean;
}) {
  let body;
  let facts: string | null = null;
  if (mode.kind === 'all') {
    const missing = missingPlaces(cue);
    facts = missing.length ? c.notWrittenFor(placeNames(missing)) : null;
    body = <MeaningLines cue={cue} meanings={cue.cue_meanings} />;
  } else if (mode.kind === 'written') {
    const { lead, others } = asWorkerSees(cue, mode.place);
    body = (
      <>
        <MeaningLines cue={cue} meanings={lead} />
        {others.length ? <p className={styles.also}>{c.alsoFor(others.map((m) => placeTitle(m)).join('; '))}</p> : null}
      </>
    );
  } else {
    const phrase = copy.labels.contextPhrase[mode.place];
    body = (
      <>
        {cue.cue_meanings.length ? (
          <p className={styles.also}>{c.writtenFor(cue.cue_meanings.map((m) => placeTitle(m)).join('; '))}</p>
        ) : null}
        <Link
          to={`/cues/${cue.id}?add=${mode.place}`}
          className={styles.addFor}
          aria-label={c.addForLabel(phrase, cue.label)}
        >
          {c.addFor(phrase)}
        </Link>
      </>
    );
  }

  return (
    <li className={styles.row}>
      <h3 className={styles.rowLabel}>
        <Link to={`/cues/${cue.id}`} data-cue={cue.id} className={styles.rowLink} aria-label={c.editLabel(cue.label)}>
          {cue.label}
        </Link>
      </h3>
      <div className={styles.rowBody}>
        {body}
        {facts ? <p className={styles.fact}>{facts}</p> : null}
      </div>
      {/* A gap row has one action, adding the meaning; the card waits for the full list. */}
      {mode.kind === 'gap' ? null : (
        <div className={styles.rowFoot}>
          {cardInSidebar && cue.pinned ? (
            <p className={styles.onCardFact}>{c.onCardFact}</p>
          ) : (
            <PinButton cue={cue} busy={busy} onPin={onPin} />
          )}
        </div>
      )}
    </li>
  );
}

/** One labelled part of the index sheet: a label over an ink rule, its count at the right. */
function Section({
  id,
  title,
  count,
  hint,
  children,
}: {
  id: string;
  title: string;
  count: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionHead}>
        <span>{title}</span> <span className={styles.sectionCount}>{count}</span>
      </h2>
      {hint ? <p className={styles.sectionHint}>{hint}</p> : null}
      {children}
    </section>
  );
}

export function CueLibrary() {
  usePageTitle(c.title);
  const { cues, profile, saveCue } = useFamilyData();
  const location = useLocation();
  const arrived = location.state as { notice?: string; focusCue?: string } | null;
  const savedNotice = arrived?.notice;
  const focusCue = arrived?.focusCue;
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<ContextTag | null>(null);
  const [notice, setNotice] = useState<string | undefined>(savedNotice);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [swapFor, setSwapFor] = useState<Cue | null>(null);
  const [focusPin, setFocusPin] = useState<string | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const wide = useWide();
  const name = profile.display_name.trim() || c.child;

  const shown = useMemo(() => filterCues(cues, query, 'all'), [cues, query]);
  const { onCard, others } = useMemo(() => groupForLibrary(shown), [shown]);
  const aToZ = useMemo(() => sortByLabel(shown), [shown]);
  // Phones keep the card's cues first; desktop lists A to Z, with the card in the side column.
  const ordered = wide ? aToZ : [...onCard, ...others];
  const byPlace = useMemo(() => (place ? splitForPlace(ordered, place) : null), [ordered, place]);
  const card = pinnedCues(cues);
  const searching = query.trim() !== '';

  // Back from the editor: focus returns to the cue that was changed. Runs after the page heading's focus.
  useEffect(() => {
    if (!focusCue) return;
    const el = layoutRef.current?.querySelector<HTMLElement>(`[data-cue="${CSS.escape(focusCue)}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: 'center' });
    // Only on arrival.
  }, []);

  // A cue that moved on or off the card keeps focus on its button, in its new place on the page.
  useEffect(() => {
    if (!focusPin) return;
    const timer = window.setTimeout(() => {
      const el = layoutRef.current?.querySelector<HTMLButtonElement>(`[data-pin="${CSS.escape(focusPin)}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: 'center' });
      setFocusPin(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusPin, cues]);

  async function run(work: () => Promise<string>, focusId: string) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      setNotice(await work());
      setFocusPin(focusId);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function onPin(cue: Cue) {
    if (!cue.pinned && card.length >= MAX_PINNED) {
      setSwapFor(cue);
      return;
    }
    const pinned = !cue.pinned;
    void run(async () => {
      const next = withPin(cue, pinned);
      await saveCue(next.cue, next.meanings);
      return pinned ? c.pinned(cue.label) : c.unpinned(cue.label);
    }, cue.id);
  }

  function swap(off: Cue) {
    const on = swapFor;
    setSwapFor(null);
    if (!on) return;
    void run(async () => {
      const offNext = withPin(off, false);
      await saveCue(offNext.cue, offNext.meanings);
      try {
        const onNext = withPin(on, true);
        await saveCue(onNext.cue, onNext.meanings);
      } catch (err) {
        // Put the card back as it was, so a failed swap never leaves a gap.
        const back = withPin(off, true);
        await saveCue(back.cue, back.meanings).catch(() => undefined);
        throw err;
      }
      return c.swapped(on.label, off.label);
    }, on.id);
  }

  const rows = (list: readonly Cue[], mode: RowMode) => (
    <ul className={styles.rows}>
      {list.map((cue) => (
        <CueRow key={cue.id} cue={cue} mode={mode} busy={busy} onPin={onPin} cardInSidebar={wide} />
      ))}
    </ul>
  );

  return (
    <FamilyShell width="wide">
      <div className={styles.libraryLayout} ref={layoutRef}>
        <div className={styles.libraryAside}>
          <header className={styles.libraryHeader}>
            <div className={styles.titleRow}>
              <PageHeading className="t-h2">{c.heading}</PageHeading>
              <ButtonLink to="/cues/new">{c.add}</ButtonLink>
            </div>
            <p className={styles.intro}>{c.intro(name)}</p>
          </header>

          {cues.length ? (
            <div className={styles.controls}>
              <SearchField label={c.searchLabel} maxLength={200} value={query} onValueChange={setQuery} />
              <PlacePicker label={c.placeLabel} value={place} onChange={setPlace} />
              {/* Always announced; only shown while searching, when the number is news. */}
              <p className={searching ? 't-small t-muted' : 'visually-hidden'} role="status" aria-live="polite">
                {c.count(shown.length, cues.length)}
              </p>
            </div>
          ) : null}

          {wide && cues.length ? (
            <section aria-labelledby="card-list" className={styles.cardList}>
              <h2 id="card-list" className={styles.sectionHead}>
                <span>{c.onCardHeading(name)}</span>{' '}
                <span className={styles.sectionCount}>{c.onCardCount(card.length, MAX_PINNED)}</span>
              </h2>
              {card.length ? (
                <ol>
                  {card.map((cue) => (
                    <li key={cue.id}>
                      <Link to={`/cues/${cue.id}`} className={styles.cardName}>
                        {cue.label}
                      </Link>
                      <PinButton cue={cue} busy={busy} onPin={onPin} short />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.sectionEmpty}>{c.onCardEmpty}</p>
              )}
            </section>
          ) : null}
        </div>

        <div className={styles.libraryMain}>
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {error ? <Banner tone="error">{error}</Banner> : null}

          {cues.length === 0 ? (
            <div className={styles.empty}>
              <WorkerPhone className={styles.art} />
              <h2 className="t-h3">{c.emptyHeading}</h2>
              <p>{c.emptyBody}</p>
            </div>
          ) : shown.length === 0 ? (
            <p className={styles.noMatch}>{c.noMatches(query.trim())}</p>
          ) : byPlace && place ? (
            <div className={styles.index}>
              {byPlace.gaps.length ? (
                <Section
                  id="gaps"
                  title={c.gapsHeading(copy.labels.contextPhrase[place])}
                  count={String(byPlace.gaps.length)}
                  hint={c.gapsHint}
                >
                  {rows(byPlace.gaps, { kind: 'gap', place })}
                </Section>
              ) : null}
              {byPlace.written.length ? (
                <Section
                  id="written"
                  title={c.writtenHeading(copy.labels.contextPhrase[place])}
                  count={String(byPlace.written.length)}
                >
                  {rows(byPlace.written, { kind: 'written', place })}
                </Section>
              ) : null}
            </div>
          ) : wide ? (
            <div className={styles.index}>
              <Section id="all-cues" title={c.allHeading} count={String(aToZ.length)}>
                {rows(aToZ, { kind: 'all' })}
              </Section>
            </div>
          ) : (
            <div className={styles.index}>
              <Section id="on-card" title={c.onCardHeading(name)} count={c.onCardCount(card.length, MAX_PINNED)}>
                {onCard.length ? (
                  rows(onCard, { kind: 'all' })
                ) : (
                  <p className={styles.sectionEmpty}>{searching ? c.onCardNoMatch : c.onCardEmpty}</p>
                )}
              </Section>
              {others.length ? (
                <Section id="other-cues" title={c.othersHeading} count={c.othersCount(others.length)}>
                  {rows(others, { kind: 'all' })}
                </Section>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <CardSwapSheet adding={swapFor?.label ?? null} pinned={card} onSwap={swap} onClose={() => setSwapFor(null)} />
    </FamilyShell>
  );
}
