import type { CardSection, Cue, CueMeaning, Profile } from '../data/types';

/**
 * Demo profile (fictional). Ari is not a real child. Used by /demo and the styleguide.
 * The phone number is from the range ACMA sets aside for fiction (0491 570 xxx).
 */

const T = '2026-11-01T09:00:00+11:00';

export const ARI_PROFILE: Profile = {
  id: 'demo-ari',
  display_name: 'Ari',
  communication_modes: ['sounds', 'gestures', 'echolalia'],
  languages: ['English'],
  language_style: 'identity_first',
  connect_note: 'Sit beside him, not in front. Wait for him to look at you before you talk.',
  who_to_call_name: 'Sam',
  who_to_call_phone: '0491 570 156',
  setup_step: 6,
  setup_started_at: T,
  setup_completed_at: T,
  updated_at: T,
};

export const ARI_SECTIONS: CardSection[] = [
  {
    section: 'toileting',
    details: {
      signs: 'Taps the bathroom door twice.',
      what_to_do: 'Take him straight away. Leave the door open a little.',
      avoid: 'Asking if he needs the toilet. He’ll say no.',
    },
    body: '',
    updated_at: T,
  },
  {
    section: 'food_drink',
    details: {
      signs: 'Says “Cookie time” at home, or brings you his lunchbox.',
      routines: 'Plain pasta, apple slices, water in the blue bottle. Snack at 10.',
      avoid: 'Mixing foods on the plate.',
    },
    body: '',
    updated_at: T,
  },
  {
    section: 'overstimulation',
    details: {
      triggers: 'Hand dryers, crowded rooms, people talking over each other.',
      early_signs: 'Rocks faster than usual, hums, covers his ears.',
    },
    body: '',
    updated_at: T,
  },
  { section: 'calms', details: {}, body: 'Lower the noise. Offer his headphones. Sit nearby and wait quietly.', updated_at: T },
  { section: 'avoid', details: {}, body: 'Touching him without warning, lots of questions, a raised voice.', updated_at: T },
];

let n = 0;
function meaning(m: Partial<CueMeaning> & Pick<CueMeaning, 'meaning'>): CueMeaning {
  n += 1;
  return {
    id: `demo-meaning-${n}`,
    cue_id: '',
    context_tags: [],
    context_text: '',
    what_to_do: '',
    what_to_avoid: '',
    confidence: 'usually',
    source: 'family',
    created_at: T,
    ...m,
  };
}

function cue(id: string, c: Omit<Cue, 'id' | 'description' | 'created_at' | 'updated_at'> & { description?: string }): Cue {
  return {
    id,
    description: '',
    created_at: T,
    updated_at: T,
    ...c,
    cue_meanings: c.cue_meanings.map((m) => ({ ...m, cue_id: id })),
  };
}

export const ARI_CUES: Cue[] = [
  cue('demo-door', {
    label: 'Taps the bathroom door twice',
    cue_type: 'behaviour',
    aliases: ['door', 'taps door', 'knocks'],
    category: 'toileting',
    pinned: true,
    pin_order: 1,
    cue_meanings: [
      meaning({
        meaning: 'I need the toilet',
        what_to_do: 'Take him straight away.',
        what_to_avoid: 'Don’t ask if he needs the toilet.',
        confidence: 'always',
      }),
    ],
  }),
  cue('demo-cookie', {
    label: 'Cookie time',
    cue_type: 'phrase',
    aliases: ['cookie', 'cookies'],
    category: 'food_drink',
    pinned: true,
    pin_order: 2,
    cue_meanings: [
      meaning({
        context_tags: ['home', 'mealtime'],
        meaning: 'I’m hungry',
        what_to_do: 'Offer a snack from his lunchbox.',
      }),
      meaning({
        context_tags: ['school'],
        meaning: 'I need a break',
        what_to_do: 'Walk with him to the quiet corner for five minutes.',
        what_to_avoid: 'Don’t offer food. It won’t help.',
      }),
    ],
  }),
  cue('demo-ears', {
    label: 'Hands over ears and humming',
    cue_type: 'behaviour',
    aliases: ['ears', 'covers ears', 'humming'],
    category: 'overstimulation',
    pinned: true,
    pin_order: 3,
    cue_meanings: [
      meaning({
        meaning: 'It’s too loud',
        what_to_do: 'Lower the noise, offer his headphones and wait quietly.',
        what_to_avoid: 'Don’t talk to him a lot or touch him.',
        confidence: 'always',
      }),
    ],
  }),
  cue('demo-wave', {
    label: 'Flat-hand wave near his face',
    cue_type: 'gesture',
    aliases: ['wave', 'hand wave'],
    category: 'connection',
    pinned: true,
    pin_order: 4,
    cue_meanings: [meaning({ meaning: 'All done, or stop', what_to_do: 'Stop the activity and give him space.' })],
  }),
  cue('demo-rocking', {
    label: 'Rocking faster than usual',
    cue_type: 'behaviour',
    aliases: ['rocking', 'rocks'],
    category: 'overstimulation',
    pinned: true,
    pin_order: 5,
    cue_meanings: [
      meaning({ meaning: 'Things are getting too much', what_to_do: 'Move somewhere quieter before it builds.' }),
    ],
  }),
  cue('demo-shoes', {
    label: 'Brings you his shoes',
    cue_type: 'behaviour',
    aliases: ['shoes'],
    category: 'other',
    pinned: false,
    pin_order: null,
    cue_meanings: [
      meaning({
        context_tags: ['home'],
        meaning: 'I want to go outside',
        what_to_do: 'Tell him when you’ll go, for example “Shoes on after lunch.”',
      }),
    ],
  }),
  cue('demo-hum', {
    label: 'Short, low “mm-mm”',
    cue_type: 'sound',
    aliases: ['mm', 'mmm', 'hum'],
    category: 'connection',
    pinned: false,
    pin_order: null,
    cue_meanings: [meaning({ meaning: 'I like this', what_to_do: 'Keep going with what you’re doing.', confidence: 'sometimes' })],
  }),
  cue('demo-bottle', {
    label: 'Blue bottle',
    cue_type: 'phrase',
    aliases: ['bottle', 'water', 'drink'],
    category: 'food_drink',
    pinned: false,
    pin_order: null,
    cue_meanings: [meaning({ meaning: 'I’m thirsty', what_to_do: 'Give him his water bottle.', confidence: 'always' })],
  }),
];
