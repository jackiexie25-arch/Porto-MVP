import { describe, expect, it } from 'vitest';
import { ARI_CUES, ARI_PROFILE, ARI_SECTIONS } from '../demo/ari';
import { makeCue, makeMeaning, makeProfile, makeSection } from '../test/fixtures';
import {
  buildCard,
  cardText,
  contextPhrase,
  countWords,
  isEmptyCard,
  joinList,
  LONG_CARD_WORDS,
  parseLanguages,
  readingMinutes,
} from './card';

describe('buildCard', () => {
  it('keeps the fixed section order and labels each answer', () => {
    const model = buildCard(
      makeProfile(),
      [
        makeSection('avoid', {}, 'Raised voices'),
        makeSection('toileting', { what_to_do: 'Go straight away', signs: 'Taps the door twice' }),
      ],
      [],
      'your child',
    );
    expect(model.sections.map((s) => s.key)).toEqual(['toileting', 'food_drink', 'overstimulation', 'calms', 'avoid']);
    expect(model.sections[0]!.lines).toEqual([
      { label: 'How they show it', text: 'Taps the door twice' },
      { label: 'What to do', text: 'Go straight away' },
    ]);
    expect(model.sections[4]!.lines).toEqual([{ text: 'Raised voices' }]);
    expect(model.sections[1]!.lines).toEqual([]);
  });

  it('writes About in at most three short lines from what the family chose', () => {
    const model = buildCard(
      makeProfile({ communication_modes: ['sounds', 'gestures', 'aac'], languages: ['English', 'Auslan'] }),
      [],
      [],
      'your child',
    );
    expect(model.about).toEqual([
      'Communicates through sounds, gestures and an AAC device.',
      'Languages: English and Auslan.',
      'Sit beside him and wait.',
    ]);
  });

  it('shows up to 5 pinned cues in pin order, with every meaning in its context', () => {
    const cues = [
      makeCue({ label: 'Second', pin_order: 2 }),
      makeCue({ label: 'Not pinned', pinned: false, pin_order: null }),
      makeCue({
        label: 'First',
        pin_order: 1,
        cue_meanings: [
          makeMeaning({ context_tags: ['home', 'mealtime'], meaning: 'I’m hungry' }),
          makeMeaning({ context_tags: ['school'], meaning: 'I need a break', what_to_do: 'Offer the quiet corner' }),
        ],
      }),
    ];
    const model = buildCard(makeProfile(), [], cues, 'your child');
    expect(model.cues.map((c) => c.label)).toEqual(['First', 'Second']);
    expect(model.cues[0]!.meanings.map((m) => [m.context, m.meaning])).toEqual([
      ['At home or at mealtimes', 'I’m hungry'],
      ['At school', 'I need a break'],
    ]);
  });

  it('uses the fallback name until the family adds one', () => {
    expect(buildCard(makeProfile({ display_name: ' ' }), [], [], 'your child').name).toBe('your child');
  });

  it('only shows who to call when there is a number', () => {
    expect(buildCard(makeProfile({ who_to_call_name: 'Sam' }), [], [], 'x').whoToCall).toBeNull();
    expect(buildCard(makeProfile({ who_to_call_phone: '0400 000 000' }), [], [], 'x').whoToCall).toEqual({
      name: '',
      phone: '0400 000 000',
    });
  });

  it('dates the card from its most recent change', () => {
    const model = buildCard(makeProfile(), [makeSection('calms', {}, 'Quiet')], [], 'x');
    expect(model.updatedAt).toBe('2026-11-02T00:00:00Z');
  });

  it('treats a brand-new profile as empty', () => {
    const blank = makeProfile({ communication_modes: [], languages: [], connect_note: '' });
    expect(isEmptyCard(buildCard(blank, [], [], 'x'))).toBe(true);
  });
});

describe('reading time', () => {
  it('reads at 200 words a minute, never less than a minute', () => {
    expect(readingMinutes(0)).toBe(1);
    expect(readingMinutes(200)).toBe(1);
    expect(readingMinutes(201)).toBe(2);
    expect(readingMinutes(LONG_CARD_WORDS)).toBe(2);
  });

  it('counts the words a worker actually reads, headings included', () => {
    const model = buildCard(
      makeProfile({ communication_modes: [], languages: [], connect_note: '' }),
      [makeSection('calms', {}, 'A quiet corner')],
      [],
      'Ari',
    );
    expect(cardText(model)).toBe('What calms A quiet corner');
    expect(countWords(cardText(model))).toBe(5);
  });
});

describe('the demo card', () => {
  it('reads in under 2 minutes (acceptance criterion 2)', () => {
    const words = countWords(cardText(buildCard(ARI_PROFILE, ARI_SECTIONS, ARI_CUES, 'Ari')));
    expect(words).toBeLessThanOrEqual(2 * 200);
    expect(readingMinutes(words)).toBeLessThanOrEqual(2);
  });
});

describe('helpers', () => {
  it('joins lists the way people say them', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'], 'or')).toBe('a, b or c');
  });

  it('describes context in plain words, including a named person or place', () => {
    expect(contextPhrase([], '')).toBe('');
    expect(contextPhrase(['other'], 'with Grandma')).toBe('With Grandma');
    expect(contextPhrase(['school', 'transport'], '')).toBe('At school or when travelling');
  });

  it('cleans up typed languages', () => {
    expect(parseLanguages(' English, Auslan , ,Mandarin')).toEqual(['English', 'Auslan', 'Mandarin']);
  });
});
