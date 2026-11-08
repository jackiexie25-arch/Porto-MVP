import { describe, expect, it } from 'vitest';
import { exportFileName } from '../data/account';
import { toCsv } from '../lib/csv';
import { formatMeasure, metricsCsv, type TeamMetrics } from '../routes/team/TeamPage';
import { confirmMatches, confirmWord } from '../routes/account/AccountPage';
import { ARI_CUES } from './ari';
import { demoSearch, demoSource } from './demoSource';

describe('demo search', () => {
  const labels = (q: string, ctx: Parameters<typeof demoSearch>[2] = null) => demoSearch(ARI_CUES, q, ctx).map((h) => h.label);

  it('ranks exact label, then alias, then close match, then meaning text', () => {
    expect(labels('Cookie time!')[0]).toBe('Cookie time');
    expect(demoSearch(ARI_CUES, 'knocks', null)[0]).toMatchObject({ label: 'Taps the bathroom door twice', match: 'alias' });
    expect(demoSearch(ARI_CUES, 'bathroom', null)[0]).toMatchObject({ match: 'similar' });
    expect(demoSearch(ARI_CUES, 'thirsty', null)[0]).toMatchObject({ label: 'Blue bottle', match: 'meaning' });
  });

  it('puts the meaning for the chosen place first', () => {
    const [atSchool] = demoSearch(ARI_CUES, 'cookie', 'school');
    expect(atSchool!.meanings[0]).toMatchObject({ meaning: 'I need a break', in_context: true });
  });

  it('never guesses', () => {
    expect(labels('giraffe trampoline')).toEqual([]);
    expect(labels('  ?! ')).toEqual([]);
  });

  it('sends nothing for notes and feedback', async () => {
    const source = demoSource();
    await expect(source.logNote({ cue_id: null, cue_text: 'x', context_tags: [], context_text: '', tried: '', seemed_to_need: '', outcome: 'worked', worker_name: '' })).resolves.toEqual({ status: 'ok' });
    await expect(source.feedback('demo-cookie', true)).resolves.toEqual({ status: 'ok' });
  });
});

describe('csv', () => {
  it('quotes where needed and neutralises formulas', () => {
    expect(toCsv([['a', 'b,c'], ['say "hi"', '=SUM(A1)']])).toBe('a,"b,c"\r\n"say ""hi""",\'=SUM(A1)');
  });

  it('exports only totals and anonymous family rows', () => {
    const m: TeamMetrics = {
      status: 'ok',
      generated_at: '2026-11-08T00:00:00Z',
      funnel: { signed_up: 3, completed_onboarding: 2, created_share: 2, worker_opened: 1, worker_searched: 1, note_logged: 1, note_approved: 0 },
      median_onboarding_minutes: 14,
      searches: 5,
      searches_per_opened_share: 5,
      zero_result_rate: 0.2,
      helped_rate: null,
      notes_logged: 1,
      approval_rate: null,
      families: [
        { family: 'Family 01', completed_onboarding: true, onboarding_minutes: 14, cues: 3, shares: 1, shares_opened: 1, searches: 5, notes_logged: 1, notes_approved: 0, card_views: 2 },
      ],
    };
    const csv = metricsCsv(m);
    expect(csv).toContain('Signed up,3');
    expect(csv).toContain('Searches with no match,20%');
    expect(csv).toContain('“Did this help?” answered yes,Not enough data yet');
    expect(csv).toContain('Family 01,Yes,14,3,1,1,5,1,0,2');
    expect(formatMeasure('median_onboarding_minutes', 14)).toBe('14');
  });
});

describe('account helpers', () => {
  it('asks for the child’s name, or DELETE before there is one', () => {
    expect(confirmWord('Ari')).toBe('Ari');
    expect(confirmWord('  ')).toBe('DELETE');
    expect(confirmMatches(' ari ', 'Ari')).toBe(true);
    expect(confirmMatches('Ar', 'Ari')).toBe(false);
  });

  it('names the export file safely', () => {
    expect(exportFileName('Ari 😊/../x', new Date('2026-11-08T05:00:00Z'))).toBe('porto-ari-x-2026-11-08.json');
    expect(exportFileName('', new Date('2026-11-08T05:00:00Z'))).toBe('porto-profile-2026-11-08.json');
  });
});
