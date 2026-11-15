import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CardPart } from '../../components/card/FirstShiftCard';
import { AutosaveStatus } from '../../components/family/AutosaveStatus';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Button, CheckIcon } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { cardLength, type CardModel } from '../../lib/card';
import type { AutosaveState } from '../../lib/useAutosave';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Setup.module.css';
import { minutesLeft, SETUP_STEPS, STEP_INFO, stepWritten } from './steps';
import { SetupPreview } from './SetupPreview';

const s = copy.setup;

/**
 * "Step 3 of 6 · about 11 minutes left", then the six parts by name: this one in ink and bold, a
 * tick beside any part that has words in it. Never a percentage, so skipping never reads as behind.
 */
function StepProgress({ step, model }: { step: number; model: CardModel }) {
  return (
    <nav aria-label={s.progressLabel} className={styles.progress}>
      {/* Phones: one calm line. From 600px: the count, then every part by name. */}
      <p className={styles.progressShort}>{s.progressShort(STEP_INFO[step - 1]!.name, step, SETUP_STEPS, minutesLeft(step))}</p>
      <p className={styles.progressText}>{s.progress(step, SETUP_STEPS, minutesLeft(step))}</p>
      <ol className={styles.parts}>
        {STEP_INFO.map((info, i) => {
          const n = i + 1;
          const current = n === step;
          const written = stepWritten(model, n);
          return (
            <li key={info.name} className={current ? styles.partCurrent : styles.part} aria-current={current ? 'step' : undefined}>
              {written ? <CheckIcon size={14} className={styles.tick} /> : null}
              <span aria-hidden="true">{info.name}</span>
              <span className="visually-hidden">{s.stepState(info.name, current, written)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface SetupFrameProps {
  step: number;
  heading: string;
  intro: ReactNode;
  /** Extra lines after the intro (the one-time tips on the first step). */
  aside?: ReactNode;
  autosave?: AutosaveState;
  /** Replaces "Saved." when only part of what's shown was saved. */
  savedText?: string;
  busy?: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  /** The whole card with what's being typed, for the progress ticks, the reading time and the preview. */
  model: CardModel;
  children: ReactNode;
}

export function SetupFrame({ step, heading, intro, aside, autosave, savedText, busy = false, onPrimary, onSkip, model, children }: SetupFrameProps) {
  usePageTitle(s.title(step));
  const parts: readonly CardPart[] = STEP_INFO[step - 1]!.parts;
  const { minutes } = cardLength(model);

  return (
    <FamilyShell width="wide">
      <div className={styles.withPreview}>
        <div className={styles.frame}>
          <StepProgress step={step} model={model} />
          <header className={styles.header}>
            {/* Focus moves here on each new step, so screen reader users hear where they are. */}
            <PageHeading className="t-h2">{heading}</PageHeading>
            <p className={styles.intro}>{intro}</p>
            {aside}
          </header>

          <div className={styles.content}>{children}</div>

          <details className={styles.previewFold}>
            <summary className={styles.previewSummary}>
              <span>{s.preview.show}</span>
              <span className={styles.fold} aria-hidden="true">
                <span className={styles.whenClosed}>{s.preview.showWord}</span>
                <span className={styles.whenOpen}>{s.preview.hide}</span>
              </span>
            </summary>
            <div className={styles.previewBody}>
              <SetupPreview model={model} parts={parts} />
            </div>
          </details>

          <div className={styles.footer}>
            <p className={styles.soFar}>{s.soFar(minutes)}</p>
            {autosave ? <AutosaveStatus state={autosave} saved={savedText} /> : null}
            <div className={styles.actions}>
              <Button onClick={onPrimary} disabled={busy}>
                {s.continue}
              </Button>
              <Button variant="secondary" onClick={onSkip} disabled={busy}>
                {s.skip}
              </Button>
            </div>
            {step > 1 ? (
              <p>
                <Link to={`/setup/${step - 1}`} className={styles.back}>
                  {s.back}
                </Link>
              </p>
            ) : null}
          </div>
        </div>

        {/* It scrolls on its own, so it can take focus for keyboard scrolling. */}
        <aside className={styles.previewAside} aria-labelledby="worker-preview">
          <div className={styles.previewHead}>
            <h2 id="worker-preview" className={styles.previewLabel}>
              {s.preview.heading}
            </h2>
            <p className={styles.previewNote}>{s.preview.note}</p>
          </div>
          <SetupPreview model={model} parts={parts} follow />
        </aside>
      </div>
    </FamilyShell>
  );
}
