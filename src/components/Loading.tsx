import { copy } from '../copy/en-AU';
import { AppShell } from './layout/AppShell';

/** A quiet holding screen. No spinner animation, just words. */
export function Loading() {
  return (
    <AppShell>
      <p role="status" className="t-muted">
        {copy.common.loading}
      </p>
    </AppShell>
  );
}
