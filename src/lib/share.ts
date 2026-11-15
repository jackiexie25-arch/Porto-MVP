import { copy } from '../copy/en-AU';

export type DurationKey = 'shift' | 'today' | 'weekend' | 'days7' | 'days14';
export const DURATIONS: readonly DurationKey[] = ['shift', 'today', 'weekend', 'days7', 'days14'];

/** The hour a weekend link closes on Monday morning (9 am, local time). */
export const WEEKEND_END_HOUR = 9;

/**
 * Hours a link stays open. "Today" runs to the family's local midnight. "Weekend" runs to the
 * coming Monday at 9 am: today's 9 am on a Monday morning, and never more than 7 days away. Max 14
 * days (336 hours), which the database also enforces. Whole hours, rounded down, so a link closes
 * before the time it promises (but always stays open at least an hour).
 */
export function durationHours(key: DurationKey, now: Date = new Date()): number {
  switch (key) {
    case 'shift':
      return 8;
    case 'today': {
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      // Whole hours only, rounded down, so the link closes before the time it promises, not after.
      return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 3_600_000));
    }
    case 'weekend': {
      return Math.max(1, Math.floor((nextMondayMorning(now).getTime() - now.getTime()) / 3_600_000));
    }
    case 'days7':
      return 168;
    case 'days14':
      return 336;
  }
}

/** The first Monday 9 am that is still ahead: today's on a Monday before 9, else the coming Monday's. */
export function nextMondayMorning(now: Date): Date {
  const monday = new Date(now);
  monday.setHours(WEEKEND_END_HOUR, 0, 0, 0);
  let days = (8 - now.getDay()) % 7;
  if (days === 0 && monday.getTime() <= now.getTime()) days = 7;
  monday.setDate(monday.getDate() + days);
  return monday;
}

/** When a link made now with this choice would close. */
export function durationEnd(key: DurationKey, now: Date = new Date()): Date {
  return new Date(now.getTime() + durationHours(key, now) * 3_600_000);
}

export interface ShareRow {
  id: string;
  label: string;
  worker_name: string;
  scope: 'card' | 'card_search' | 'card_search_log';
  expires_at: string;
  revoked_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  created_at: string;
}

export function isOpen(share: ShareRow, now: Date = new Date()): boolean {
  return !share.revoked_at && new Date(share.expires_at) > now;
}

/** "Tuesday 4:30 pm", or with the date when it's more than 6 days away. */
export function formatUntil(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const far = date.getTime() - now.getTime() > 6 * 24 * 3_600_000;
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    ...(far ? { day: 'numeric', month: 'long' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** "5 minutes ago", "yesterday". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, 'minute');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86_400), 'day');
}

/** The status line on the family's list of links. */
export function shareStatus(share: ShareRow, now: Date = new Date()): string {
  const s = copy.share.status;
  if (!isOpen(share, now)) return s.closed;
  const opened = share.last_opened_at ? s.opened(timeAgo(share.last_opened_at, now)) : s.notOpened;
  return `${opened} · ${s.openUntil(formatUntil(share.expires_at, now))}`;
}

export function shareUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/s/${token}`;
}
