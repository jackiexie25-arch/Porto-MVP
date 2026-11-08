import { getSupabase } from '../lib/supabase';

/** The only events the browser reports. Everything else is recorded by the database itself. */
export type BrowserEvent = 'onboarding_step_completed' | 'onboarding_completed' | 'card_viewed_by_family' | 'profile_exported';

/**
 * First-party analytics only. Fire and forget: a failed event never interrupts the family.
 * The database rebuilds props from a fixed list, so nothing free-text is ever stored.
 */
export function logEvent(name: BrowserEvent, props: Record<string, number> = {}): void {
  try {
    void getSupabase()
      .rpc('log_event', { p_name: name, p_props: props })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Not connected (for example in tests or the demo): nothing to record.
  }
}
