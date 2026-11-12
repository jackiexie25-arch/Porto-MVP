import { copy } from '../../copy/en-AU';
import type { Cue } from '../../data/types';
import { Button, Sheet } from '../ui';
import styles from './CardSwapSheet.module.css';

const c = copy.cues;

/**
 * The card is full: choose which cue comes off to make room for another. A choice, never a dead
 * end. The family's own labels, in card order, as a ruled list.
 */
export function CardSwapSheet({
  adding,
  pinned,
  onSwap,
  onClose,
}: {
  /** The label of the cue that should go on the card, or null when the sheet is closed. */
  adding: string | null;
  pinned: readonly Cue[];
  onSwap: (remove: Cue) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={adding !== null} onClose={onClose} title={c.swapTitle}>
      <p>{adding !== null ? c.swapBody(adding) : null}</p>
      <ul className={styles.list}>
        {pinned.map((cue, i) => (
          <li key={cue.id}>
            <button type="button" className={styles.option} onClick={() => onSwap(cue)}>
              {/* Its place on the card, the order a worker reads them. */}
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.optionLabel}>{cue.label}</span>
              <span className={styles.optionAction}>{c.takeOff}</span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="outlined" onClick={onClose}>
          {c.swapKeep}
        </Button>
      </div>
    </Sheet>
  );
}
