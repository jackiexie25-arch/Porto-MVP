import { copy } from '../../copy/en-AU';
import type { AutosaveState } from '../../lib/useAutosave';
import { Banner } from '../ui';
import styles from './AutosaveStatus.module.css';

/**
 * Quiet "Saving…" / "Saved." line, announced politely. Errors show a calm banner instead.
 * `saved` replaces "Saved." when only part of what's on screen was saved (a name, but not a
 * number that can't be right yet), so the line never claims more than happened.
 */
export function AutosaveStatus({ state, saved = copy.setup.saved }: { state: AutosaveState; saved?: string }) {
  if (state === 'error') return <Banner tone="error">{copy.setup.saveFailed}</Banner>;
  return (
    <p className={styles.status} role="status" aria-live="polite">
      {state === 'saving' ? copy.setup.saving : state === 'saved' ? saved : ''}
    </p>
  );
}
