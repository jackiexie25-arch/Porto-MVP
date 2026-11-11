import type { Ref } from 'react';
import { Button } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { CardLine } from '../lib/card';
import styles from './Worker.module.css';

const w = copy.worker;

/** Nothing matches: say so plainly, offer what usually helps, and one way to tell the family. */
export function NoMatch({
  name,
  calms,
  headingRef,
  onTell,
}: {
  name: string;
  calms: readonly CardLine[];
  headingRef?: Ref<HTMLParagraphElement>;
  onTell?: () => void;
}) {
  return (
    <div className={styles.noMatch}>
      <p ref={headingRef} tabIndex={-1} className={styles.noMatchHeading}>
        {w.noMatch(name)}
      </p>
      <p className={styles.hint}>{w.noMatchTry}</p>
      {calms.length ? (
        <div className={styles.calm}>
          <p className={styles.calmLabel}>{w.noMatchCalm}</p>
          {calms.map((line) => (
            <p key={line.text} className={styles.calmText}>
              {line.text}
            </p>
          ))}
        </div>
      ) : null}
      {onTell ? (
        <div>
          <Button variant="outlined" onClick={onTell}>
            {w.tellFamily(name)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
