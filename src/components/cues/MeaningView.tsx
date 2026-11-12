import { copy } from '../../copy/en-AU';
import type { CardCueMeaning } from '../../lib/card';
import styles from './MeaningView.module.css';

const m = copy.meaning;

export type MeaningDensity = 'brief' | 'compact' | 'full' | 'lead' | 'large';

export interface MeaningViewProps {
  /** The family's words for one meaning, with its place phrased (see `cardMeaning` in lib/card). */
  meaning: CardCueMeaning;
  /** The meaning for where the worker says they are: marked with an ink rule on the left. */
  inContext?: boolean;
  /**
   * brief: one calm unit, the place and confidence after the meaning on the same line (the card's
   * Top cues). compact: lists (library, setup). full: worker search results. lead: the one answer for
   * where the worker is, a step louder than full. large: held out to show someone.
   */
  density?: MeaningDensity;
  /**
   * Which parts to show. Everything is shown by default; empty answers are always left out. Leave out
   * the context line only where the place is already the heading just above (the cue editor).
   */
  show?: { context?: boolean; confidence?: boolean; whatToDo?: boolean; avoid?: boolean };
  className?: string;
}

/**
 * One meaning in its context: where (with how sure the family is), what it means, then what to do
 * and what to avoid. Only ever the family's own words. Used by the worker bundle, so it must not
 * import Supabase or anything from the family app.
 */
export function MeaningView({ meaning, inContext = false, density = 'full', show = {}, className }: MeaningViewProps) {
  const { context = true, confidence = true, whatToDo = true, avoid = true } = show;
  const where = meaning.context || m.anywhere;
  const contextText = confidence ? m.contextLine(where, copy.labels.confidenceInline[meaning.confidence]) : where;
  const doText = whatToDo ? meaning.whatToDo.trim() : '';
  const avoidText = avoid ? meaning.whatToAvoid.trim() : '';

  return (
    <div className={[styles.root, styles[density], inContext ? styles.inContext : '', className ?? ''].join(' ')}>
      {density === 'brief' ? (
        <p className={styles.meaning}>
          {meaning.meaning}
          <span className={styles.where}> · {contextText}</span>
        </p>
      ) : (
        <>
          {context ? <p className={styles.context}>{contextText}</p> : null}
          <p className={styles.meaning}>{meaning.meaning}</p>
        </>
      )}
      {doText || avoidText ? (
        <dl className={styles.actions}>
          {doText ? (
            <div className={styles.row}>
              <dt>{m.whatToDo}</dt>
              <dd className={styles.do}>{doText}</dd>
            </div>
          ) : null}
          {avoidText ? (
            <div className={styles.row}>
              <dt>{m.avoid}</dt>
              <dd className={styles.avoid}>{avoidText}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
