import { copy } from '../copy/en-AU';

interface MaybeError {
  message?: string;
  status?: number;
  code?: string;
}

/** Turns any thrown or returned error into calm copy that says what to do next. */
export function friendlyError(error: unknown): string {
  const e = (error ?? {}) as MaybeError;
  const message = e.message ?? '';
  if (message.includes('not_configured')) return copy.errors.notConfigured;
  if (message.includes('invalid_invite_code')) return copy.errors.inviteCode;
  if (message.includes('consent_required')) return copy.errors.consentFirst;
  if (message.includes('pin_limit')) return copy.errors.pinLimit;
  if (e.status === 429 || /rate limit|too many/i.test(message)) return copy.common.tryAgainSoon;
  if (/fetch|network|load failed/i.test(message)) return copy.errors.offline;
  return copy.errors.generic;
}
