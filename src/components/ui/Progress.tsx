import { copy } from '../../copy/en-AU';
import styles from './Progress.module.css';

/**
 * A row of small steps. Never a percentage bar. The text says "Step 2 of 6" and nothing more,
 * so skipping a step never reads as falling behind.
 */
export function Progress({ current, total, label }: { current: number; total: number; label: string }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <nav aria-label={label} className={styles.progress}>
      <ol className={styles.steps}>
        {steps.map((step) => {
          const state = step === current ? 'current' : step < current ? 'done' : 'todo';
          return (
            <li
              key={step}
              className={[styles.step, styles[state]].join(' ')}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="visually-hidden">
                {copy.common.stepOf(step, total)}
                {state === 'current' ? `, ${copy.common.currentStep}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.text} aria-hidden="true">
        {copy.common.stepOf(current, total)}
      </p>
    </nav>
  );
}
