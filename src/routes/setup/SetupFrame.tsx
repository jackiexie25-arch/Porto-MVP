import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AutosaveStatus } from '../../components/family/AutosaveStatus';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Button } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { AutosaveState } from '../../lib/useAutosave';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Setup.module.css';

const s = copy.setup;

/** The six question steps. The card-ready page that follows isn't counted as a step. */
export const SETUP_STEPS = 6;

/** Rough minutes for each step, adding up to the 15-minute target. */
export const STEP_MINUTES: readonly number[] = [3, 2, 2, 3, 1, 4];

/** Minutes for this step and the ones after it. */
export function minutesLeft(step: number): number {
  return STEP_MINUTES.slice(step - 1).reduce((sum, m) => sum + m, 0);
}

/**
 * "Step 2 of 6 · About 9 minutes left" over a row of six marks, one per step. Never a percentage,
 * so skipping a step never reads as falling behind. Screen readers hear the named list of steps.
 */
function StepMeter({ step }: { step: number }) {
  return (
    <nav aria-label={s.progressLabel} className={styles.meter}>
      <p className={styles.meterText} aria-hidden="true">
        <span className={styles.meterStep}>{copy.common.stepOf(step, SETUP_STEPS)}</span>
        <span>{s.minutesLeft(minutesLeft(step))}</span>
      </p>
      <ol className={styles.marks}>
        {s.stepNames.map((name, i) => {
          const n = i + 1;
          const state = n === step ? 'current' : n < step ? 'done' : 'todo';
          return (
            <li key={name} className={[styles.mark, styles[state]].join(' ')} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="visually-hidden">
                {copy.common.stepOf(n, SETUP_STEPS)}: {s.stepState(name, state)}
              </span>
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
  primaryLabel?: string;
  busy?: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  /** The section as a worker will read it: beside the questions on desktop, folded under them on a phone. */
  preview?: ReactNode;
  children: ReactNode;
}

export function SetupFrame({
  step,
  heading,
  intro,
  aside,
  autosave,
  primaryLabel = s.continue,
  busy = false,
  onPrimary,
  onSkip,
  preview,
  children,
}: SetupFrameProps) {
  usePageTitle(s.title(step));

  return (
    <FamilyShell width={preview ? 'wide' : 'narrow'}>
      <div className={preview ? styles.withPreview : undefined}>
        <div className={styles.frame}>
          <StepMeter step={step} />
          <header className={styles.header}>
            {/* Focus moves here on each new step, so screen reader users hear where they are. */}
            <PageHeading className="t-h2">{heading}</PageHeading>
            <p className={styles.intro}>{intro}</p>
            {aside}
          </header>

          <div className={styles.content}>{children}</div>

          {preview ? (
            <details className={styles.previewFold}>
              <summary className={styles.previewSummary}>
                <span>{s.preview.show}</span>
                <span className={styles.fold} aria-hidden="true">
                  <span className={styles.whenClosed}>{s.preview.showWord}</span>
                  <span className={styles.whenOpen}>{s.preview.hide}</span>
                </span>
              </summary>
              <div className={styles.previewBody}>{preview}</div>
            </details>
          ) : null}

          <div className={styles.footer}>
            {autosave ? <AutosaveStatus state={autosave} /> : null}
            <div className={styles.actions}>
              <Button onClick={onPrimary} disabled={busy}>
                {primaryLabel}
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

        {preview ? (
          <aside className={styles.previewAside} aria-labelledby="worker-preview">
            <h2 id="worker-preview" className={styles.previewLabel}>
              {s.preview.heading}
            </h2>
            {preview}
          </aside>
        ) : null}
      </div>
    </FamilyShell>
  );
}
