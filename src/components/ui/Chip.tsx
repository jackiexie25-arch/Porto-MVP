import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { CheckIcon } from './Icons';
import styles from './Chip.module.css';

export type TagTone = 'quiet' | 'rose';

/**
 * A small, static label. It must never look like something you can tap, so it has no pill fill:
 * a quiet outline that wraps with its text. Rose is kept for one tag type only (family confidence),
 * and is rarely needed now that MeaningView words confidence into the context line.
 */
export function Tag({ tone = 'quiet', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={[styles.tag, styles[tone]].join(' ')}>{children}</span>;
}

export type ChoiceChipProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'> & {
  selected: boolean;
};

/**
 * A selectable chip, 48px tall. At rest: surface with a control border. Selected: sky fill,
 * 2px ink border and a tick beside the word, so the choice reads at a glance.
 */
export function ChoiceChip({ selected, className, children, ...rest }: ChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.choice, selected ? styles.selected : '', className ?? ''].join(' ')}
      {...rest}
    >
      {selected ? <CheckIcon size={16} className={styles.tick} /> : null}
      <span className={styles.choiceText}>{children}</span>
    </button>
  );
}

/** Lays chips out in a wrapping row. Give it an accessible name with aria-label or aria-labelledby. */
export function ChipGroup(props: ComponentPropsWithoutRef<'div'>) {
  return <div role="group" {...props} className={[styles.group, props.className ?? ''].join(' ')} />;
}
