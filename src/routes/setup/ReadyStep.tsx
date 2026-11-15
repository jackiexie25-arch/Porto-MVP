import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChecklistSun } from '../../assets/illustrations';
import { FirstShiftCard, type CardPart } from '../../components/card/FirstShiftCard';
import { FamilyShell } from '../../components/family/FamilyShell';
import { QuestionSheet } from '../../components/family/Question';
import { WhoFields } from '../../components/family/WhoFields';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, Button, ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { logEvent } from '../../data/events';
import { phoneLooksValid, whoDraftFrom } from '../../family/drafts';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useCardModel } from '../../family/useCardModel';
import { cardLength, partWritten, type CardModel } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Setup.module.css';
import { stepFor } from './steps';

const r = copy.setup.ready;
const c = copy.card;

export type Readiness = 'needsWho' | 'noToileting' | 'ready';

/**
 * Honest about what a worker can't do without: never "ready" without someone to call, or without
 * toileting. Someone to call comes first.
 */
export function readiness(model: CardModel): Readiness {
  if (!model.whoToCall) return 'needsWho';
  if (!partWritten(model, 'toileting')) return 'noToileting';
  return 'ready';
}

/** "Ari", or "Your child" when no name is typed, so a heading never starts in lower case. */
function headingName(model: CardModel, hasName: boolean): string {
  return hasName ? model.name : 'Your child';
}

/** Adding someone to call, right here, so it never needs a trip back through setup. */
function AddWho({ onAdded }: { onAdded: () => void }) {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => whoDraftFrom(profile));
  const [strict, setStrict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const sectionRef = useRef<HTMLElement>(null);

  async function add() {
    setStrict(true);
    // An empty or unfinished number can't be added; the field says so, and focus goes to it.
    if (!draft.who_to_call_phone.trim() || !phoneLooksValid(draft.who_to_call_phone)) {
      sectionRef.current?.querySelector<HTMLInputElement>('input[type="tel"]')?.focus();
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ who_to_call_name: draft.who_to_call_name.trim(), who_to_call_phone: draft.who_to_call_phone.trim() });
      onAdded();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section ref={sectionRef} aria-labelledby="no-one" className={styles.addWho}>
      <h2 id="no-one" className={styles.addedHead}>
        <span>{r.noOne}</span>
      </h2>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <QuestionSheet flat>
        <WhoFields draft={draft} onChange={setDraft} strict={strict} requirePhone compact level={3} />
      </QuestionSheet>
      <div className={styles.readyActions}>
        <Button onClick={() => void add()} disabled={saving}>
          {r.addWho}
        </Button>
      </div>
    </section>
  );
}

/**
 * The end of setup: the card exactly as a worker sees it, with any gaps stated in place, and one
 * next step. Arriving here finishes setup, so the family's home is the card from now on.
 */
export function ReadyStep() {
  usePageTitle(r.title);
  const { profile, saveProfile } = useFamilyData();
  const { model, hasName } = useCardModel();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const marked = useRef(false);

  useEffect(() => {
    if (profile.setup_completed_at || marked.current) return;
    marked.current = true;
    saveProfile({ setup_step: 6, setup_completed_at: new Date().toISOString() })
      .then(() => {
        logEvent('onboarding_step_completed', { step: 6 });
        logEvent('onboarding_completed');
      })
      .catch((err: unknown) => setError(friendlyError(err)));
  }, [profile.setup_completed_at, saveProfile]);

  const state = readiness(model);
  const name = headingName(model, hasName);
  const { words, minutes } = cardLength(model);
  const heading = state === 'needsWho' ? r.headingNeedsWho(name) : state === 'noToileting' ? r.headingNoToileting(name) : r.heading(name);
  const intro = state === 'needsWho' ? r.introNeedsWho : state === 'noToileting' ? r.introNoToileting : r.intro;

  // A gap in the card links to the step that writes it.
  function action(part: CardPart, title: string, empty: boolean) {
    if (!empty) return null;
    return (
      <Link to={`/setup/${stepFor(part)}`} className={styles.addLink} aria-label={c.addLabel(title)}>
        {c.add}
      </Link>
    );
  }

  return (
    <FamilyShell>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.readyHeader}>
            <PageHeading className="t-h2">{heading}</PageHeading>
            {state === 'ready' ? <ChecklistSun className={styles.readyArt} /> : null}
          </div>
          <p className={styles.intro}>{intro}</p>
        </header>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {state === 'needsWho' ? (
          <AddWho onAdded={() => document.querySelector<HTMLElement>('main h1')?.focus()} />
        ) : (
          <div className={styles.readyActions}>
            {state === 'noToileting' ? (
              <ButtonLink to={`/setup/${stepFor('toileting')}`}>{r.addToileting}</ButtonLink>
            ) : (
              <Button onClick={() => navigate('/share')}>{r.share}</Button>
            )}
          </div>
        )}

        {/* The other ways on are plain links, never a stack of buttons. */}
        <p className={styles.otherWays}>
          {state !== 'ready' ? (
            <Link to="/share" className={styles.addLink}>
              {state === 'needsWho' ? r.shareWithout : r.shareAnyway}
            </Link>
          ) : null}
          <Link to="/card" className={styles.addLink}>
            {r.later}
          </Link>
        </p>

        <section aria-label={r.cardLabel} className={styles.cardBlock}>
          <p className={styles.readingTime}>{c.readingTime(words, minutes)}</p>
          <FirstShiftCard
            model={model}
            variant="family"
            family={{ action }}
            hide={state === 'needsWho' ? ['who'] : []}
          />
        </section>
      </div>
    </FamilyShell>
  );
}
