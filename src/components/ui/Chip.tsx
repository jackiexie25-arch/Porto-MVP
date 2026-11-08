import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import styles from './Chip.module.css';

export type TagTone = 'sky' | 'rose';

/** A small, static label. Rose is kept for one tag type only (family confidence). */
export function Tag({ tone = 'sky', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={[styles.tag, tone === 'rose' ? styles.rose : ''].join(' ')}>{children}</span>;
}

export type ChoiceChipProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'> & {
  selected: boolean;
};

/** A selectable chip, 44px tall. Selected shows a 2px ink border and a check. */
export function ChoiceChip({ selected, className, children, ...rest }: ChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.tag, styles.choice, selected ? styles.selected : '', className ?? ''].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Lays chips out in a wrapping row. Give it an accessible name with aria-label or aria-labelledby. */
export function ChipGroup(props: ComponentPropsWithoutRef<'div'>) {
  return <div role="group" {...props} className={[styles.group, props.className ?? ''].join(' ')} />;
}
