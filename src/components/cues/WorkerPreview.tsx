import { copy } from '../../copy/en-AU';
import type { ContextTag } from '../../data/types';
import { cardMeaning } from '../../lib/card';
import { arrangeMeanings } from '../../worker/arrange';
import type { MeaningDraft } from './drafts';
import { MeaningView } from './MeaningView';
import styles from './WorkerPreview.module.css';

const w = copy.worker;

/**
 * The cue being written, set the way a worker's search result sets it for `place`: the family's
 * label quiet, the meaning for here first, other places one step quieter, and the worker view's own
 * words when nothing is written for here. Only what the family has typed so far.
 */
export function WorkerPreview({
  label,
  meanings,
  place,
  name,
  emptyText,
}: {
  label: string;
  meanings: readonly MeaningDraft[];
  place: ContextTag | null;
  name: string;
  emptyText: string;
}) {
  const written = meanings
    .filter((m) => m.meaning.trim())
    .map((m) => ({ ...m, in_context: place !== null && m.context_tags.includes(place) }));
  if (!written.length) return <p className={styles.empty}>{emptyText}</p>;

  const { lead, others, notice } = arrangeMeanings(written, place);
  return (
    <div className={styles.result}>
      {label.trim() ? <p className={styles.label}>{label}</p> : null}
      {notice === 'notHere' && place ? (
        <p className={styles.notice}>{w.notWrittenHere(name, copy.labels.contextPhrase[place])}</p>
      ) : null}
      {notice === 'choosePlace' ? <p className={styles.notice}>{w.choosePlace(name)}</p> : null}
      {lead.map((m) => (
        <MeaningView key={m.key} meaning={cardMeaning(m)} density="full" inContext={place !== null} />
      ))}
      {others.length ? (
        <div className={styles.others}>
          {lead.length ? <p className={styles.othersLabel}>{w.otherPlaces}</p> : null}
          {others.map((m) => (
            <MeaningView key={m.key} meaning={cardMeaning(m)} density="compact" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
