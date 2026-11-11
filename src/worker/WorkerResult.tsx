import { useEffect, useRef, type Ref } from 'react';
import { MeaningView } from '../components/cues/MeaningView';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { cardMeaning } from '../lib/card';
import { arrangeMeanings } from './arrange';
import type { SearchHit } from './types';
import styles from './Worker.module.css';

const w = copy.worker;

export type FeedbackState = 'sending' | 'done' | 'error';

/** "Did this help? Yes · Not really" as one quiet line. After an answer: thanks, and "Add a note". */
function Feedback({
  label,
  state,
  onAnswer,
  onNote,
}: {
  label: string;
  state?: FeedbackState;
  onAnswer: (helpful: boolean) => void;
  onNote?: () => void;
}) {
  const thanksRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state === 'done') thanksRef.current?.focus();
  }, [state]);

  if (state === 'done') {
    return (
      <div className={styles.quietLine}>
        <p ref={thanksRef} tabIndex={-1} className={styles.thanks} role="status">
          {w.feedbackThanks}
        </p>
        {onNote ? (
          <button type="button" className={styles.textButton} onClick={onNote} aria-label={w.feedbackNoteLabel(label)}>
            {w.feedbackNote}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={styles.quietLine}>
      <p className={styles.quietLabel}>{w.feedbackQuestion}</p>
      {[true, false].map((helpful) => (
        <button
          key={String(helpful)}
          type="button"
          className={styles.textButton}
          disabled={state === 'sending'}
          onClick={() => onAnswer(helpful)}
          aria-label={helpful ? w.feedbackYesLabel(label) : w.feedbackNoLabel(label)}
        >
          {helpful ? w.feedbackYes : w.feedbackNo}
        </button>
      ))}
      {state === 'error' ? <p className={styles.quietLabel}>{copy.common.tryAgainSoon}</p> : null}
    </div>
  );
}

/**
 * One result, set as the answer: what the worker saw (the family's label, quiet), the meaning for
 * here (loudest), the other places one step quieter, and one quiet line of actions.
 */
export function WorkerResult({
  hit,
  name,
  place,
  headingRef,
  onOpen,
  feedback,
  onFeedback,
  onNote,
}: {
  hit: SearchHit;
  name: string;
  place: ContextTag | null;
  headingRef?: Ref<HTMLHeadingElement>;
  onOpen: () => void;
  feedback?: FeedbackState;
  onFeedback: (helpful: boolean) => void;
  onNote?: () => void;
}) {
  const { lead, others, notice } = arrangeMeanings(hit.meanings, place);
  return (
    <li className={styles.result}>
      <h3 ref={headingRef} tabIndex={-1} className={styles.resultLabel}>
        {hit.label}
      </h3>
      {notice === 'notHere' && place ? (
        <p className={styles.notice}>{w.notWrittenHere(name, copy.labels.contextPhrase[place])}</p>
      ) : null}
      {notice === 'choosePlace' ? <p className={styles.notice}>{w.choosePlace(name)}</p> : null}
      {lead.map((m, i) => (
        <MeaningView key={i} meaning={cardMeaning(m)} density="lead" inContext={place !== null} />
      ))}
      {others.length ? (
        <div className={styles.others}>
          {lead.length ? <p className={styles.othersLabel}>{w.otherPlaces}</p> : null}
          {others.map((m, i) => (
            <MeaningView key={i} meaning={cardMeaning(m)} density="compact" />
          ))}
        </div>
      ) : null}
      <div className={styles.resultActions}>
        <button type="button" className={styles.textButton} onClick={onOpen} aria-label={w.biggerLabel(hit.label)}>
          {w.bigger}
        </button>
        <Feedback label={hit.label} state={feedback} onAnswer={onFeedback} onNote={onNote} />
      </div>
    </li>
  );
}
