import { useId } from 'react';
import { copy } from '../copy/en-AU';
import type { CardCue } from '../lib/card';
import styles from './Worker.module.css';

const w = copy.worker;

/** The family's pinned cues, as a short index of text rows. Tapping one looks it up. */
export function QuickCues({ name, cues, onPick }: { name: string; cues: readonly CardCue[]; onPick: (label: string) => void }) {
  const headingId = useId();
  if (!cues.length) return null;
  return (
    <div className={styles.quick}>
      <p id={headingId} className={styles.quickHeading}>
        {w.quickHeading(name)}
      </p>
      <p className={styles.hint}>{w.quickHint}</p>
      <ul className={styles.quickList} aria-labelledby={headingId}>
        {cues.map((cue) => (
          <li key={cue.id}>
            <button type="button" className={styles.quickButton} onClick={() => onPick(cue.label)}>
              {cue.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
