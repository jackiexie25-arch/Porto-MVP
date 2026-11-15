import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChecklistSun } from '../../assets/illustrations';
import { FirstShiftCard, type CardPart } from '../../components/card/FirstShiftCard';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, Button, ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { logEvent } from '../../data/events';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useCardModel } from '../../family/useCardModel';
import type { CardModel } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Setup.module.css';

const r = copy.setup.ready;

/** Where each missing part is written. */
const WRITTEN_AT: Record<CardPart, string> = {
  about: '/setup/1',
  toileting: '/setup/2',
  food_drink: '/setup/3',
  overstimulation: '/setup/4',
  calms: '/setup/4',
  avoid: '/setup/4',
  who: '/setup/5',
  cues: '/setup/6',
};

/** What a worker won't find on the card, as plain facts. Who to call comes first: it matters most. */
export function missingParts(model: CardModel, hasCues: boolean): { part: CardPart; to: string }[] {
  const missing: CardPart[] = [];
  if (!model.whoToCall) missing.push('who');
  if (!model.note && !model.about.length) missing.push('about');
  for (const section of model.sections) if (!section.lines.length) missing.push(section.key);
  if (!model.cues.length) missing.push('cues');
  // Cues written but none on the card are chosen in the library, not added again.
  return missing.map((part) => ({ part, to: part === 'cues' && hasCues ? '/cues' : WRITTEN_AT[part] }));
}

/**
 * The end of setup: the card exactly as a worker sees it, what's still missing, and one next step.
 * Arriving here finishes setup, so the family's home is the card from now on.
 */
export function ReadyStep() {
  usePageTitle(r.title);
  const { profile, cues, saveProfile } = useFamilyData();
  const { model, words, minutes, hasName } = useCardModel();
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

  const missing = missingParts(model, cues.length > 0);
  const name = hasName ? model.name : copy.setup.yourChild;
  const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const heading = model.whoToCall ? r.heading(title(name)) : r.headingNearly(title(name));

  return (
    <FamilyShell>
      <div className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.readyHeader}>
            <PageHeading className="t-h2">{heading}</PageHeading>
            <ChecklistSun className={styles.readyArt} />
          </div>
          <p className={styles.intro}>{r.intro}</p>
        </header>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {/* The next step sits in the first screen, however much is still missing. */}
        <div className={styles.readyActions}>
          <Button onClick={() => navigate('/share')}>{r.share}</Button>
          <ButtonLink to="/card" variant="secondary">
            {r.later}
          </ButtonLink>
        </div>

        {missing.length ? (
          <section aria-labelledby="missing" className={styles.missing}>
            <h2 id="missing" className={styles.addedHead}>
              <span>{r.missingHeading}</span>
              <span className={styles.addedCount}>{missing.length}</span>
            </h2>
            <ul className={styles.missingList}>
              {missing.map(({ part, to }) => (
                <li key={part} className={styles.missingItem}>
                  <span>{r.missing[part]}</span>
                  <Link to={to} className={styles.addLink} aria-label={r.addLabel(r.missing[part])}>
                    {r.add}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label={r.cardLabel} className={styles.cardBlock}>
          <p className={styles.readingTime}>{copy.card.readingTime(words, minutes)}</p>
          <FirstShiftCard model={model} variant="worker" />
        </section>
      </div>
    </FamilyShell>
  );
}
