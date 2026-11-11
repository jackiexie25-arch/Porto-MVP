import { describe, expect, it } from 'vitest';
import type { ContextTag } from '../data/types';
import { arrangeMeanings } from './arrange';

const m = (tags: ContextTag[], inContext = false, text = '') => ({
  context_tags: tags,
  context_text: text,
  in_context: inContext,
  meaning: tags.join('+') || text || 'anywhere',
});

describe('arrangeMeanings', () => {
  it('leads with the meaning for the chosen place and keeps the others below', () => {
    const school = m(['school'], true);
    const home = m(['home', 'mealtime']);
    expect(arrangeMeanings([home, school], 'school')).toEqual({ lead: [school], others: [home], notice: 'none' });
  });

  it('uses a meaning written for no particular place when none is written for here', () => {
    const anywhere = m([]);
    const home = m(['home']);
    expect(arrangeMeanings([home, anywhere], 'camp')).toEqual({ lead: [anywhere], others: [home], notice: 'none' });
  });

  it('says so plainly when the family wrote nothing for this place', () => {
    const home = m(['home']);
    const grandma = m([], false, 'With Grandma');
    expect(arrangeMeanings([home, grandma], 'camp')).toEqual({ lead: [], others: [home, grandma], notice: 'notHere' });
  });

  it('asks for a place when no place is chosen and meanings differ by place', () => {
    const result = arrangeMeanings([m(['home']), m(['school'])], null);
    expect(result.notice).toBe('choosePlace');
    expect(result.lead).toHaveLength(2);
  });

  it('shows a single meaning without any prompt', () => {
    expect(arrangeMeanings([m([])], null).notice).toBe('none');
    expect(arrangeMeanings([m([])], 'school').notice).toBe('none');
  });
});
