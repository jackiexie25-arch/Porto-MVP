import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { answerLength } from '../../lib/length';
import { AlertIcon } from '../ui';
import fieldStyles from '../ui/Field.module.css';
import styles from './Question.module.css';

interface QuestionLook {
  /** Heading level, so questions sit under the page's or section's own heading. */
  level?: 2 | 3;
  /** Smaller questions, for changing one part of the card in place. */
  compact?: boolean;
}

function headingClass(compact: boolean | undefined) {
  return compact ? styles.askCompact : styles.ask;
}

function setRefs<T>(el: T | null, inner: { current: T | null }, outer?: Ref<T>) {
  inner.current = el;
  if (typeof outer === 'function') outer(el);
  else if (outer) (outer as { current: T | null }).current = el;
}

export interface WritingQuestionProps extends QuestionLook {
  question: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** One line (a name, a phrase) or a few sentences. */
  multiline?: boolean;
  /** A short note under the question, before the example. */
  hint?: ReactNode;
  /** An answer someone else might give. The family can tap it to start from it, then make it theirs. */
  example?: string;
  /** Show "About right." or "shorter helps" under the box while writing. Off for names and numbers. */
  lengthGuide?: boolean;
  error?: string;
  inputRef?: Ref<HTMLTextAreaElement | HTMLInputElement>;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'tel';
}

/**
 * One question in the setup interview: the question as a heading (it is also the field's label),
 * an example above the box that the family can start from, the box, and a quiet length line.
 */
export function WritingQuestion({
  question,
  value,
  onChange,
  maxLength,
  multiline = true,
  hint,
  example,
  lengthGuide = multiline,
  error,
  inputRef,
  type = 'text',
  inputMode,
  level = 2,
  compact,
}: WritingQuestionProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const lengthId = `${id}-length`;
  const errorId = `${id}-error`;
  const inner = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const empty = value.trim() === '';
  // The example's "Start from this" stays put while the family types (so the box never jumps), and
  // is offered again only once they leave the box empty.
  const [offer, setOffer] = useState(empty);
  const Heading = level === 3 ? 'h3' : 'h2';
  const length = lengthGuide ? answerLength(value) : 'empty';

  useEffect(() => {
    const el = inner.current;
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function startFrom(text: string) {
    if (!empty) return;
    onChange(text);
    setOffer(false);
    // Focus at once, so nothing typed straight after the tap goes astray; the cursor goes to the end
    // once the new words are in the box.
    inner.current?.focus();
    requestAnimationFrame(() => inner.current?.setSelectionRange(text.length, text.length));
  }

  const describedBy = [hint ? hintId : '', lengthGuide ? lengthId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const common = {
    id: inputId,
    value,
    maxLength,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    onBlur: () => setOffer(value.trim() === ''),
  };

  return (
    <div className={[styles.question, compact ? styles.compact : ''].join(' ')}>
      <Heading className={headingClass(compact)}>
        <label htmlFor={inputId}>{question}</label>
      </Heading>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {example ? (
        offer ? (
          <button
            type="button"
            className={styles.example}
            onClick={() => startFrom(example)}
            aria-disabled={empty ? undefined : true}
          >
            <span className={styles.quote}>“{example}”</span>
            <span className={empty ? styles.use : styles.useOff}>{copy.setup.useExample}</span>
          </button>
        ) : (
          <p className={styles.exampleText}>
            <span className={styles.exampleLabel}>{copy.setup.example}: </span>“{example}”
          </p>
        )
      ) : null}
      {multiline ? (
        <textarea
          ref={(el) => setRefs(el, inner, inputRef as Ref<HTMLTextAreaElement> | undefined)}
          rows={compact ? 2 : 3}
          className={[fieldStyles.control, fieldStyles.textarea, styles.box].join(' ')}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      ) : (
        <input
          ref={(el) => setRefs(el, inner, inputRef as Ref<HTMLInputElement> | undefined)}
          type={type}
          inputMode={inputMode}
          autoComplete="off"
          className={fieldStyles.control}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      )}
      {error ? (
        <p id={errorId} className={fieldStyles.error}>
          <AlertIcon size={18} className={fieldStyles.errorIcon} />
          <span className="visually-hidden">{copy.common.errorIconLabel}: </span>
          <span>{error}</span>
        </p>
      ) : null}
      {lengthGuide ? (
        <p id={lengthId} className={styles.length}>
          {length === 'empty' ? '' : copy.setup.length[length]}
        </p>
      ) : null}
    </div>
  );
}

/** A question answered by ticking or choosing: the question is the group's legend. */
export function ChoiceQuestion({
  question,
  hint,
  level = 2,
  compact,
  children,
}: QuestionLook & { question: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <fieldset className={[styles.question, styles.fieldset, compact ? styles.compact : ''].join(' ')} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className={styles.legend}>
        <Heading className={headingClass(compact)}>{question}</Heading>
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <div className={styles.choices}>{children}</div>
    </fieldset>
  );
}

/** Questions on one sheet, divided by hairlines. */
export function QuestionSheet({ children, flat = false }: { children: ReactNode; flat?: boolean }) {
  return <div className={flat ? styles.flat : styles.sheet}>{children}</div>;
}
