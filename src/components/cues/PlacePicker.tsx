import { useId } from 'react';
import { copy } from '../../copy/en-AU';
import type { ContextTag } from '../../data/types';
import { ChipGroup, ChoiceChip } from '../ui';
import styles from './PlacePicker.module.css';

/** The same five places a worker chooses from, so the family can read a cue from there. */
export const WORKER_PLACES = copy.worker.contexts as readonly ContextTag[];

/**
 * "See what a worker reads at [Home] [School] …": one place or none. Tapping the chosen place
 * again goes back to every place, as in the worker view.
 */
export function PlacePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ContextTag | null;
  onChange: (place: ContextTag | null) => void;
}) {
  const id = useId();
  return (
    <div className={styles.picker}>
      <p id={id} className={styles.label}>
        {label}
      </p>
      <ChipGroup aria-labelledby={id}>
        {WORKER_PLACES.map((p) => (
          <ChoiceChip key={p} selected={value === p} onClick={() => onChange(value === p ? null : p)}>
            {copy.labels.context[p]}
          </ChoiceChip>
        ))}
      </ChipGroup>
    </div>
  );
}
