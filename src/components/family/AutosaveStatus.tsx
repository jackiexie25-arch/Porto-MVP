import { copy } from '../../copy/en-AU';
import type { AutosaveState } from '../../lib/useAutosave';
import { Banner } from '../ui';
import styles from './AutosaveStatus.module.css';

/** Quiet "Saving…" / "Saved." line, announced politely. Errors show a calm banner instead. */
export function AutosaveStatus({ state }: { state: AutosaveState }) {
  if (state === 'error') return <Banner tone="error">{copy.setup.saveFailed}</Banner>;
  return (
    <p className={styles.status} role="status" aria-live="polite">
      {state === 'saving' ? copy.setup.saving : state === 'saved' ? copy.setup.saved : ''}
    </p>
  );
}
