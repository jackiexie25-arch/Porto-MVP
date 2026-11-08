import { describe, expect, it } from 'vitest';
import cases from '../../supabase/tests/normalise-cases.json';
import { ARI_CUES } from '../demo/ari';
import { filterCues, normaliseQuery } from './search';

describe('normaliseQuery', () => {
  it.each(cases as Array<[string, string]>)('normalises %j to %j, the same as the database', (input, expected) => {
    expect(normaliseQuery(input)).toBe(expected);
  });
});

describe('filterCues', () => {
  it('matches every typed word across label, aliases and meanings', () => {
    expect(filterCues(ARI_CUES, 'COOKIE!', 'all').map((c) => c.label)).toEqual(['Cookie time']);
    expect(filterCues(ARI_CUES, 'break school', 'all')).toHaveLength(0);
    expect(filterCues(ARI_CUES, 'need break', 'all').map((c) => c.label)).toEqual(['Cookie time']);
    expect(filterCues(ARI_CUES, 'water', 'all').map((c) => c.label)).toEqual(['Blue bottle']);
  });

  it('filters by category, with or without words', () => {
    expect(filterCues(ARI_CUES, '', 'overstimulation').map((c) => c.label)).toEqual([
      'Hands over ears and humming',
      'Rocking faster than usual',
    ]);
    expect(filterCues(ARI_CUES, 'ears', 'toileting')).toEqual([]);
    expect(filterCues(ARI_CUES, '', 'all')).toHaveLength(ARI_CUES.length);
  });
});
