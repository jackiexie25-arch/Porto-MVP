import { describe, expect, it } from 'vitest';
import { makeCue, makeMeaning } from '../../test/fixtures';
import {
  asWorkerSees,
  cardCountAfter,
  coversPlace,
  groupForLibrary,
  isAnywhere,
  lacksWhatToDo,
  missingPlaces,
  splitForPlace,
  withPin,
} from './library';

describe('place gaps', () => {
  const home = makeCue({ id: 'home', cue_meanings: [makeMeaning({ context_tags: ['home', 'mealtime'] })] });
  const anywhere = makeCue({ id: 'any', cue_meanings: [makeMeaning({ context_tags: [], context_text: '' })] });

  it('lists the worker places a cue has nothing written for, leaving out mealtime', () => {
    expect(missingPlaces(home)).toEqual(['school', 'camp', 'community']);
  });

  it('a meaning for anywhere covers every place', () => {
    expect(isAnywhere(anywhere.cue_meanings[0]!)).toBe(true);
    expect(missingPlaces(anywhere)).toEqual([]);
    expect(coversPlace(anywhere, 'camp')).toBe(true);
  });

  it('a named person is not anywhere', () => {
    expect(isAnywhere(makeMeaning({ context_tags: [], context_text: 'with Grandma' }))).toBe(false);
  });

  it('a cue with no meanings has no gaps to report', () => {
    expect(missingPlaces(makeCue({ cue_meanings: [] }))).toEqual([]);
  });

  it('splits cues by whether a worker at a place finds something, keeping their order', () => {
    expect(splitForPlace([home, anywhere], 'camp')).toEqual({ gaps: [home], written: [anywhere] });
    expect(splitForPlace([home, anywhere], 'home')).toEqual({ gaps: [], written: [home, anywhere] });
  });

  it('counts the card after a save, never past five', () => {
    expect(cardCountAfter(5, true, true)).toBe(5);
    expect(cardCountAfter(4, true, false)).toBe(5);
    expect(cardCountAfter(5, false, false)).toBe(5);
    expect(cardCountAfter(3, false, false)).toBe(3);
  });
});

describe('groupForLibrary', () => {
  it('keeps the card’s cues in card order and sorts the rest A to Z', () => {
    const cues = [
      makeCue({ label: 'zebra', pinned: false, pin_order: null }),
      makeCue({ label: 'Second', pinned: true, pin_order: 2 }),
      makeCue({ label: 'apple', pinned: false, pin_order: null }),
      makeCue({ label: 'First', pinned: true, pin_order: 1 }),
    ];
    const { onCard, others } = groupForLibrary(cues);
    expect(onCard.map((c) => c.label)).toEqual(['First', 'Second']);
    expect(others.map((c) => c.label)).toEqual(['apple', 'zebra']);
  });
});

describe('asWorkerSees', () => {
  const cue = makeCue({
    cue_meanings: [
      makeMeaning({ id: 'home', context_tags: ['home'] }),
      makeMeaning({ id: 'any', context_tags: [], context_text: '' }),
    ],
  });

  it('leads with the meaning for the place, as the worker view does', () => {
    const { lead, others } = asWorkerSees(makeCue({ cue_meanings: [makeMeaning({ id: 'school', context_tags: ['school'] })] }), 'school');
    expect(lead.map((m) => m.id)).toEqual(['school']);
    expect(others).toEqual([]);
  });

  it('falls back to a meaning written for anywhere, never to another place', () => {
    const { lead, others, notice } = asWorkerSees(cue, 'camp');
    expect(lead.map((m) => m.id)).toEqual(['any']);
    expect(others.map((m) => m.id)).toEqual(['home']);
    expect(notice).toBe('none');
  });

  it('says nothing is written when there is no meaning for here or anywhere', () => {
    const only = makeCue({ cue_meanings: [makeMeaning({ context_tags: ['home'] })] });
    expect(asWorkerSees(only, 'school').notice).toBe('notHere');
  });
});

describe('withPin', () => {
  it('changes only the pin, keeping every meaning’s id', () => {
    const cue = makeCue({ pinned: false, aliases: ['cookie'], cue_meanings: [makeMeaning({ id: 'm1' })] });
    const { cue: input, meanings } = withPin(cue, true);
    expect(input).toMatchObject({ id: cue.id, label: cue.label, aliases: ['cookie'], pinned: true });
    expect(meanings.map((m) => m.id)).toEqual(['m1']);
  });
});

it('lacksWhatToDo is a plain fact about empty text', () => {
  expect(lacksWhatToDo({ what_to_do: '  ' })).toBe(true);
  expect(lacksWhatToDo({ what_to_do: 'Offer a snack' })).toBe(false);
});
