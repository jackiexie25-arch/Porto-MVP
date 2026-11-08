import { describe, expect, it } from 'vitest';
import { qrPath } from '../components/share/QrCode';
import { durationHours, isOpen, shareStatus, shareUrl, timeAgo, type ShareRow } from './share';

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
    expect(durationHours('days3', now)).toBe(72);
    expect(durationHours('days7', now)).toBe(168);
    expect(durationHours('days14', now)).toBe(336);
  });

  it('runs "today" to local midnight, and at least an hour', () => {
    expect(durationHours('today', now)).toBe(10); // 2:30 pm → midnight, rounded up
    expect(durationHours('today', new Date('2026-11-10T23:50:00'))).toBe(1);
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
