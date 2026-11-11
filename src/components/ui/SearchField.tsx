import { useId, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import styles from './SearchField.module.css';

export type SearchFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'onChange' | 'id' | 'size'> & {
  label: string;
  hint?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  /** large: the worker's search, the first thing on the page. standard: a filter on a family page. */
  size?: 'large' | 'standard';
};

/**
 * A labelled search box with the standard ink focus ring. The browser's own clear cross is hidden
 * and replaced by a visible, 48px "Clear" text button while there's something to clear.
 */
export function SearchField({ label, hint, value, onValueChange, size = 'standard', className, ...rest }: SearchFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = `${id}-hint`;

  return (
    <div className={[styles.field, styles[size], className ?? ''].join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.box}>
        <input
          ref={inputRef}
          id={id}
          type="search"
          className={styles.input}
          aria-describedby={hint ? hintId : undefined}
          autoComplete="off"
          {...rest}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        {value ? (
          <button
            type="button"
            className={styles.clear}
            aria-label={copy.searchField.clearLabel}
            onClick={() => {
              onValueChange('');
              inputRef.current?.focus();
            }}
          >
            {copy.searchField.clear}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
