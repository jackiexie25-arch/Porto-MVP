import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AutosaveStatus } from '../../components/family/AutosaveStatus';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Button, Progress } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { AutosaveState } from '../../lib/useAutosave';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Setup.module.css';

export const SETUP_STEPS = 6;

interface SetupFrameProps {
  step: number;
  heading: string;
  intro: string;
  art?: ReactNode;
  /** Shows the dictation tip and the medical reminder (steps with free-text answers). */
  writingTips?: boolean;
  autosave?: AutosaveState;
  primaryLabel?: string;
  busy?: boolean;
  showSkip?: boolean;
  onPrimary: () => void;
  onSkip?: () => void;
  children: ReactNode;
}

export function SetupFrame({
  step,
  heading,
  intro,
  art,
  writingTips = false,
  autosave,
  primaryLabel = copy.setup.continue,
  busy = false,
  showSkip = true,
  onPrimary,
  onSkip,
  children,
}: SetupFrameProps) {
  usePageTitle(copy.setup.title(step));
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new step's heading, so screen reader users hear where they are.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <FamilyShell>
      <div className={styles.frame}>
        <Progress current={step} total={SETUP_STEPS} label={copy.setup.progressLabel} />
        {art ? <div className={styles.art}>{art}</div> : null}
        <header className={styles.header}>
          <h1 ref={headingRef} tabIndex={-1} className={`t-h2 ${styles.heading}`}>
            {heading}
          </h1>
          <p className="t-body-lg">{intro}</p>
          {writingTips ? (
            <>
              <p className="t-small t-muted">{copy.setup.dictation}</p>
              <p className="t-small t-muted">{copy.setup.medical}</p>
            </>
          ) : null}
        </header>

        <div className={styles.content}>{children}</div>

        {autosave ? <AutosaveStatus state={autosave} /> : null}

        <div className={styles.actions}>
          <Button onClick={onPrimary} disabled={busy}>
            {primaryLabel}
          </Button>
          {showSkip && onSkip ? (
            <Button variant="secondary" onClick={onSkip} disabled={busy}>
              {copy.setup.skip}
            </Button>
          ) : null}
        </div>
        {step > 1 ? (
          <p>
            <Link to={`/setup/${step - 1}`}>{copy.setup.back}</Link>
          </p>
        ) : null}
      </div>
    </FamilyShell>
  );
}
