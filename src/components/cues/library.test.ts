import { describe, expect, it } from 'vitest';
import { makeCue, makeMeaning } from '../../test/fixtures';
import { asWorkerSees, groupForLibrary, lacksWhatToDo, withPin } from './library';

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
