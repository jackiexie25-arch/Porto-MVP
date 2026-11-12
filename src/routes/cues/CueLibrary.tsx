import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WorkerPhone } from '../../assets/illustrations';
import { asWorkerSees, groupForLibrary, lacksWhatToDo, withPin } from '../../components/cues/library';
import { MeaningView } from '../../components/cues/MeaningView';
import { PlacePicker } from '../../components/cues/PlacePicker';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, Button, ButtonLink, SearchField, Sheet } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { ContextTag, Cue, CueMeaning } from '../../data/types';
import { MAX_PINNED, useFamilyData } from '../../family/FamilyDataProvider';
import { cardMeaning, pinnedCues } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { filterCues } from '../../lib/search';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cues;

/** "At school: I need a break", one line per meaning. The place first, as a worker reads it. */
function MeaningLines({ meanings }: { meanings: readonly CueMeaning[] }) {
  return (
    <ul className={styles.lines}>
      {meanings.map((m) => (
        <li key={m.id}>
          <span className={styles.where}>{cardMeaning(m).context || copy.meaning.anywhere}:</span>{' '}
          <span className={styles.says}>{m.meaning}</span>
          {lacksWhatToDo(m) ? <span className={styles.fact}>{c.missingDo}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** What a worker who chose `place` reads first for this cue, and what else is written. */
function AsWorkerSees({ cue, place }: { cue: Cue; place: ContextTag }) {
  const { lead, others, notice } = asWorkerSees(cue, place);
  if (notice === 'notHere') {
    return (
      <>
        <p className={styles.fact}>{c.notWrittenFor(copy.labels.contextPhrase[place])}</p>
        <MeaningLines meanings={others} />
      </>
    );
  }
  return (
    <>
      {lead.map((m) => (
        <div key={m.id} className={styles.lead}>
          <MeaningView meaning={cardMeaning(m)} density="compact" inContext />
          {lacksWhatToDo(m) ? <p className={styles.fact}>{c.missingDo}</p> : null}
        </div>
      ))}
      {others.length ? (
        <p className={styles.also}>
          {c.alsoFor(others.map((m) => cardMeaning(m).context || copy.meaning.anywhere).join('; '))}
        </p>
      ) : null}
    </>
  );
}

function CueRow({
  cue,
  place,
  busy,
  onPin,
}: {
  cue: Cue;
  place: ContextTag | null;
  busy: boolean;
  onPin: (cue: Cue) => void;
}) {
  return (
    <li className={styles.row}>
      <h3 className={styles.rowLabel}>
        <Link to={`/cues/${cue.id}`} className={styles.rowLink} aria-label={c.editLabel(cue.label)}>
          {cue.label}
        </Link>
      </h3>
      <button
        type="button"
        data-pin={cue.id}
        className={styles.pin}
        disabled={busy}
        onClick={() => onPin(cue)}
        aria-label={cue.pinned ? c.pinRemoveLabel(cue.label) : c.pinAddLabel(cue.label)}
      >
        {cue.pinned ? c.pinRemove : c.pinAdd}
      </button>
      <div className={styles.rowBody}>
        {place ? <AsWorkerSees cue={cue} place={place} /> : <MeaningLines meanings={cue.cue_meanings} />}
      </div>
    </li>
  );
}

export function CueLibrary() {
  usePageTitle(c.title);
  const { cues, profile, saveCue } = useFamilyData();
  const location = useLocation();
  const savedNotice = (location.state as { notice?: string } | null)?.notice;
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<ContextTag | null>(null);
  const [notice, setNotice] = useState<string | undefined>(savedNotice);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [swapFor, setSwapFor] = useState<Cue | null>(null);
  const [focusPin, setFocusPin] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const name = profile.display_name.trim() || c.child;

  const shown = useMemo(() => filterCues(cues, query, 'all'), [cues, query]);
  const { onCard, others } = useMemo(() => groupForLibrary(shown), [shown]);
  const pinnedCount = cues.filter((cue) => cue.pinned).length;
  const searching = query.trim() !== '';

  // A cue that moved on or off the card keeps focus on its button, in its new place on the page.
  useEffect(() => {
    if (!focusPin) return;
    const timer = window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-pin="${CSS.escape(focusPin)}"]`);
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
    if (!cue.pinned && pinnedCount >= MAX_PINNED) {
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

  function swap(off: Cue, on: Cue) {
    setSwapFor(null);
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

  return (
    <FamilyShell width="wide">
      <div className={styles.libraryLayout}>
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
        </div>

        <div className={styles.libraryMain} ref={listRef}>
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
          ) : (
            <>
              <section aria-labelledby="on-card" className={styles.group}>
                <div className={styles.groupHead}>
                  <h2 id="on-card" className={styles.groupTitle}>
                    {c.onCardHeading(name)}
                  </h2>
                  <p className={styles.groupMeta}>{c.onCardCount(pinnedCount, MAX_PINNED)}</p>
                </div>
                {onCard.length ? (
                  <ul className={styles.sheet}>
                    {onCard.map((cue) => (
                      <CueRow key={cue.id} cue={cue} place={place} busy={busy} onPin={onPin} />
                    ))}
                  </ul>
                ) : (
                  <p className={styles.groupEmpty}>{searching ? c.onCardNoMatch : c.onCardEmpty}</p>
                )}
              </section>

              {others.length ? (
                <section aria-labelledby="other-cues" className={styles.group}>
                  <div className={styles.groupHead}>
                    <h2 id="other-cues" className={styles.groupTitle}>
                      {c.othersHeading}
                    </h2>
                    <p className={styles.groupMeta}>{c.othersCount(others.length)}</p>
                  </div>
                  <ul className={styles.sheet}>
                    {others.map((cue) => (
                      <CueRow key={cue.id} cue={cue} place={place} busy={busy} onPin={onPin} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Sheet open={swapFor !== null} onClose={() => setSwapFor(null)} title={c.swapTitle}>
        {swapFor ? (
          <>
            <p>{c.swapBody(swapFor.label)}</p>
            <ul className={styles.swapList}>
              {pinnedCues(cues).map((cue) => (
                  <li key={cue.id}>
                    <Button variant="outlined" fullWidth className={styles.swapOption} onClick={() => swap(cue, swapFor)}>
                      {c.swapOption(cue.label)}
                    </Button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Sheet>
    </FamilyShell>
  );
}
