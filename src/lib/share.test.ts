import { describe, expect, it } from 'vitest';
import { qrPath } from '../components/share/QrCode';
import {
  closesAt,
  closesWhen,
  durationChoices,
  durationEnd,
  durationHours,
  DURATIONS,
  isOpen,
  shareStatus,
  shareUrl,
  timeAgo,
  type ShareRow,
} from './share';

const now = new Date('2026-11-10T14:30:00');

function share(overrides: Partial<ShareRow> = {}): ShareRow {
  return {
    id: 's1',
    label: 'Camp weekend',
    worker_name: '',
    scope: 'card_search_log',
    expires_at: new Date(now.getTime() + 8 * 3_600_000).toISOString(),
    revoked_at: null,
    first_opened_at: null,
    last_opened_at: null,
    created_at: now.toISOString(),
    ...overrides,
  };
}

describe('durationHours', () => {
  it('maps each choice to hours, never more than 14 days', () => {
    expect(durationHours('shift', now)).toBe(8);
    expect(durationHours('days7', now)).toBe(168);
    expect(durationHours('days14', now)).toBe(336);
  });

  it('runs "today" to local midnight, and at least an hour', () => {
    expect(durationHours('today', now)).toBe(9); // 2:30 pm → 11:30 pm, never past midnight
    expect(durationHours('today', new Date('2026-11-10T23:50:00'))).toBe(1);
  });
});

describe('weekend links', () => {
  it('run to the next Monday morning, whichever day they are made', () => {
    // Friday 6 pm → Monday 9 am.
    expect(durationHours('weekend', new Date('2026-11-13T18:00:00'))).toBe(63);
    // Tuesday 2:30 pm → Monday 16 November, rounded down to the hour (8:30 am).
    expect(durationEnd('weekend', now).getDate()).toBe(16);
    // Sunday → the next day.
    expect(durationEnd('weekend', new Date('2026-11-15T10:00:00')).getDate()).toBe(16);
    // Monday after 9 am → the coming Monday.
    expect(durationEnd('weekend', new Date('2026-11-16T10:00:00')).getDate()).toBe(23);
  });

  it('on a Monday before 9 am means this morning, never next week', () => {
    const mondayEarly = new Date('2026-11-16T03:00:00');
    expect(durationHours('weekend', mondayEarly)).toBe(6);
    expect(durationEnd('weekend', mondayEarly).toString()).toBe(new Date('2026-11-16T09:00:00').toString());
    // Just before 9 it still stays open for at least an hour.
    expect(durationHours('weekend', new Date('2026-11-16T08:30:00'))).toBe(1);
  });

  it('is never more than 7 days, at any hour of any day', () => {
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const at = new Date(2026, 10, 9 + d, h, 30);
        expect(durationHours('weekend', at)).toBeGreaterThanOrEqual(1);
        expect(durationHours('weekend', at)).toBeLessThanOrEqual(7 * 24);
      }
    }
  });
});

describe('which choices are offered, and when each closes', () => {
  it('offers the weekend every day except a Monday before 9 am, when it would close within hours', () => {
    expect(durationChoices(now)).toEqual([...DURATIONS]);
    expect(durationChoices(new Date('2026-11-15T22:00:00'))).toContain('weekend'); // Sunday night
    expect(durationChoices(new Date('2026-11-16T03:00:00'))).not.toContain('weekend'); // Monday 3 am
    expect(durationChoices(new Date('2026-11-16T09:30:00'))).toContain('weekend'); // Monday after 9
  });

  it('says “before midnight tonight”, never “Wednesday 12:00 am”', () => {
    expect(closesWhen('today', now)).toBe('by midnight tonight');
    // At 11:50 pm the shortest link is an hour, so it says when it really closes.
    expect(closesWhen('today', new Date('2026-11-10T23:50:00'))).toMatch(/^tomorrow at 12:50/);
  });

  it('says today or tomorrow plainly, and the day further out', () => {
    expect(closesWhen('shift', now)).toMatch(/^today at 10:30/); // 2:30 pm + 8 hours
    expect(closesWhen('shift', new Date('2026-11-10T20:00:00'))).toMatch(/^tomorrow at 4:00/);
    expect(closesWhen('days7', now)).toMatch(/^Tuesday/);
    expect(closesAt(new Date('2026-11-24T14:30:00'), now)).toMatch(/24 November/);
  });
});

describe('share status', () => {
  it('says whether a link has been opened and when it closes', () => {
    expect(shareStatus(share(), now)).toMatch(/^Not opened yet · Open until /);
    const opened = share({ last_opened_at: new Date(now.getTime() - 5 * 60_000).toISOString() });
    expect(shareStatus(opened, now)).toMatch(/^Opened 5 minutes ago · Open until /);
  });

  it('shows closed for revoked or expired links', () => {
    expect(isOpen(share({ revoked_at: now.toISOString() }), now)).toBe(false);
    expect(shareStatus(share({ expires_at: new Date(now.getTime() - 1000).toISOString() }), now)).toBe('Closed');
  });

  it('describes time in plain words', () => {
    expect(timeAgo(now.toISOString(), now)).toBe('this minute');
    expect(timeAgo(new Date(now.getTime() - 26 * 3_600_000).toISOString(), now)).toBe('yesterday');
  });

  it('builds the worker link from the token', () => {
    expect(shareUrl('abc', 'https://porto.example')).toBe('https://porto.example/s/abc');
  });
});

describe('qrPath', () => {
  it('draws a square code with a quiet zone, the same every time', () => {
    const url = shareUrl('A'.repeat(43), 'https://porto.example');
    const a = qrPath(url);
    expect(a.size).toBeGreaterThanOrEqual(21 + 8);
    expect(a.d).toMatch(/^M4 4h1v1h-1z/); // top-left finder pattern starts inside the quiet zone
    expect(qrPath(url)).toEqual(a);
  });
});
