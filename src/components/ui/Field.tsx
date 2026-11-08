import {
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { copy } from '../../copy/en-AU';
import { AlertIcon } from './Icons';
import styles from './Field.module.css';

interface FieldFrameProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
}

interface FrameIds {
  inputId: string;
  describedBy: string | undefined;
}

function useFrameIds(hint: ReactNode | undefined, error: string | undefined): FrameIds & {
  hintId: string;
  errorId: string;
} {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return { inputId: `${id}-input`, hintId, errorId, describedBy };
}

function FieldFrame({
  label,
  hint,
  error,
  optional,
  inputId,
  hintId,
  errorId,
  children,
}: FieldFrameProps & { inputId: string; hintId: string; errorId: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {optional ? <span className={styles.optional}> ({copy.common.optional.toLowerCase()})</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error}>
      <AlertIcon size={18} className={styles.errorIcon} />
      <span className="visually-hidden">{copy.common.errorIconLabel}: </span>
      <span>{children}</span>
    </p>
  );
}

/** `ref` reaches the input, so forms can move focus to the first field that needs attention. */
export type TextFieldProps = FieldFrameProps & Omit<ComponentPropsWithRef<'input'>, 'id'>;

export function TextField({ label, hint, error, optional, className, ...rest }: TextFieldProps) {
  const ids = useFrameIds(hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} {...ids}>
      <input
        id={ids.inputId}
        className={[styles.control, className ?? ''].join(' ')}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldFrame>
  );
}

export type TextAreaProps = FieldFrameProps & Omit<ComponentPropsWithoutRef<'textarea'>, 'id'>;

/** Grows with its content so nothing the family writes is hidden behind a scrollbar. */
export function TextArea({ label, hint, error, optional, className, value, rows = 3, ...rest }: TextAreaProps) {
  const ids = useFrameIds(hint, error);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} {...ids}>
      <textarea
        ref={ref}
        id={ids.inputId}
        rows={rows}
        value={value}
        className={[styles.control, styles.textarea, className ?? ''].join(' ')}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </FieldFrame>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectProps = FieldFrameProps &
  Omit<ComponentPropsWithoutRef<'select'>, 'id'> & { options: readonly SelectOption[] };

export function Select({ label, hint, error, optional, options, className, ...rest }: SelectProps) {
  const ids = useFrameIds(hint, error);
  return (
    <FieldFrame label={label} hint={hint} error={error} optional={optional} {...ids}>
      <select
        id={ids.inputId}
        className={[styles.control, styles.select, className ?? ''].join(' ')}
        aria-describedby={ids.describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

export type CheckboxProps = { label: string } & Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'id'>;

export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className={[styles.checkRow, className ?? ''].join(' ')}>
      <input id={id} type="checkbox" className={styles.checkbox} {...rest} />
      <label htmlFor={id} className={styles.checkLabel}>
        {label}
      </label>
    </div>
  );
}

/** Groups checkboxes or chips under one legend. */
export function FieldSet({ legend, hint, children }: { legend: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <fieldset className={styles.fieldset} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className={styles.label}>{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <div className={styles.fieldsetBody}>{children}</div>
    </fieldset>
  );
}

/** Stacks fields with the standard field gap. */
export function FieldStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}
