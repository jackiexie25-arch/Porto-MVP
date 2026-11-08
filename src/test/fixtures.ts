import type { CardSection, Cue, CueMeaning, Profile } from '../data/types';

/** Fictional test data only. Never real children. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    display_name: 'Ari',
    communication_modes: ['sounds', 'gestures'],
    languages: ['English'],
    language_style: 'identity_first',
    connect_note: 'Sit beside him and wait.',
    who_to_call_name: '',
    who_to_call_phone: '',
    setup_step: 1,
    setup_started_at: null,
    setup_completed_at: null,
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

export function makeSection(section: CardSection['section'], details: Record<string, string> = {}, body = ''): CardSection {
  return { section, details, body, updated_at: '2026-11-02T00:00:00Z' };
}

export function makeMeaning(overrides: Partial<CueMeaning> = {}): CueMeaning {
  return {
    id: `m-${Math.random()}`,
    cue_id: 'c',
    context_tags: ['home'],
    context_text: '',
    meaning: 'I’m hungry',
    what_to_do: 'Offer a snack',
    what_to_avoid: '',
    confidence: 'usually',
    source: 'family',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

export function makeCue(overrides: Partial<Cue> = {}): Cue {
  return {
    id: `c-${Math.random()}`,
    label: 'Cookie time',
    cue_type: 'phrase',
    description: '',
    aliases: [],
    category: 'food_drink',
    pinned: true,
    pin_order: 1,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    cue_meanings: [makeMeaning()],
    ...overrides,
  };
}
