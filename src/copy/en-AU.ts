/**
 * Every user-facing string in Porto lives here, grouped by screen.
 * Voice: plain, kind, practical. Lead with what to do. Families are in charge.
 * Australian spelling. No exclamation marks. `npm run lint:copy` enforces the avoid-list.
 * All drafted copy is listed in DECISIONS.md under "Needs human review".
 */

export const copy = {
  meta: {
    appName: 'Porto',
    tagline: 'Know what to do, from the first shift.',
    pageTitle: (page: string) => `${page} · Porto`,
  },

  layout: {
    skipLink: 'Skip to main content',
    logoAlt: 'Porto',
    homeLink: 'Porto home',
    menuOpen: 'Menu',
    menuClose: 'Close menu',
    mainNav: 'Main',
    emergency: 'If it’s an emergency, call 000.',
  },

  welcome: {
    title: 'Welcome',
    heading: 'Know what to do, from the first shift.',
    intro:
      'Porto helps the people who support your child understand them from day one. You write down what you already know: how your child shows they need the toilet, food or a break, and what their sounds, words and gestures mean in different places.',
    who: 'For families of minimally verbal autistic children, and the support workers, camp leaders and aides who spend time with them.',
    control: 'Families choose who sees the profile, and for how long.',
    styleguideLink: 'See the styleguide',
  },

  notFound: {
    title: 'Page not found',
    heading: 'This page isn’t here',
    body: 'Check the link, or go back to the start.',
    homeLink: 'Go to the start',
  },

  common: {
    close: 'Close',
    cancel: 'Cancel',
    saved: 'Saved.',
    linkCopied: 'Link copied.',
    optional: 'Optional',
    tryAgainSoon: 'Please try again in a moment.',
    stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
    currentStep: 'current step',
    completedStep: 'done',
    successIconLabel: 'Done',
    errorIconLabel: 'Needs attention',
    infoIconLabel: 'Note',
  },

  illustrations: {
    welcome: 'An adult and a child standing side by side, holding hands.',
    workerPhone: 'A support worker reading a phone.',
    quietCorner: 'A quiet corner with a cushion, headphones and a plant.',
    checklist: 'A finished checklist under a warm sun.',
    calmWave: 'A sun over a calm wave.',
  },

  styleguide: {
    title: 'Styleguide',
    heading: 'Porto styleguide',
    intro: 'Every token, type style and component in one place. Use only these.',
    sections: {
      colour: 'Colour',
      type: 'Type',
      spacing: 'Spacing and radius',
      logo: 'Logo',
      buttons: 'Buttons',
      fields: 'Fields',
      cards: 'Cards',
      nav: 'Navigation',
      chips: 'Tags and chips',
      banners: 'Messages',
      progress: 'Progress',
      sheet: 'Bottom sheet',
      illustrations: 'Illustrations',
    },
    typeSamples: {
      hero: 'Hero: Know what to do',
      h2: 'Heading 2: Food and drink',
      h3: 'Heading 3: What calms',
      bodyLg: 'Body large: Offer the same food again before trying something new.',
      body: 'Body: Take him straight to the toilet. Don’t ask if he needs to go.',
      small: 'Small: You can use a nickname.',
      button: 'Button: Save and continue',
    },
    logoWordmark: 'Wordmark on ground',
    logoWordmarkSurface: 'Wordmark on surface',
    logoMark: 'Mark',
    logoAppIcon: 'App icon',
    buttons: {
      primary: 'Save and continue',
      primaryDisabled: 'Share for this shift',
      secondary: 'Finish later',
      outlined: 'Preview as a worker',
      disabledNote: 'Disabled',
    },
    fields: {
      nameLabel: 'First name or nickname',
      nameHint: 'A nickname is fine. You don’t need to use their real name.',
      namePlaceholder: 'For example, Ari',
      notesLabel: 'What helps you connect',
      notesHint: 'For example: sitting side by side, not face to face.',
      selectLabel: 'How sure are you?',
      selectOptions: { always: 'Always', usually: 'Usually', sometimes: 'Sometimes' },
      checkboxGroup: 'How do they mainly communicate?',
      checkboxSpeech: 'Speech',
      checkboxSounds: 'Sounds',
      checkboxGestures: 'Gestures',
      errorLabel: 'Phone number',
      errorValue: '04 1234',
      errorMessage: 'This number looks short. Check it has 10 digits, like 0412 345 678.',
    },
    card: {
      heading: 'Toileting',
      body: 'Ari taps the bathroom door twice when he needs the toilet. Take him straight away.',
      caption: 'Demo profile (fictional). Not a real child.',
    },
    navLinks: { cues: 'Cues', card: 'First-shift card', inbox: 'Inbox' },
    navPrimary: 'Share for a shift',
    chips: {
      tagHome: 'Home',
      tagSchool: 'School',
      tagRose: 'Usually',
      chipGroup: 'Where are you?',
      places: ['Home', 'School', 'Camp', 'Out and about', 'Mealtime'],
    },
    banners: {
      success: 'Saved.',
      error: 'We couldn’t save that just now. Your words are still here. Please try again in a moment.',
      info: 'This is getting long. Workers read this on their first shift. Is anything here better kept in the cue library?',
    },
    progressLabel: 'Profile setup',
    sheet: {
      open: 'Open the sheet',
      title: 'Did this help?',
      body: 'Your answer goes to Ari’s family. It helps them keep the profile useful.',
      yes: 'Yes',
      no: 'Not really',
    },
  },
} as const;

export type Copy = typeof copy;
