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
    trial: 'Porto is in an early trial. You’ll need an invite code from the Porto team to start.',
    start: 'Start with an invite code',
    signIn: 'Sign in',
    continue: 'Go to your profile',
    privacyLink: 'How Porto looks after your information',
  },

  signUp: {
    title: 'Start',
    heading: 'Start your child’s profile',
    intro: 'We’ll email you a link to sign in. There’s no password to remember.',
    emailLabel: 'Your email',
    emailHint: 'We only use this to send you sign-in links.',
    codeLabel: 'Invite code',
    codeHint: 'It’s in the message the Porto team sent you, for example PORTO-7KQM-X4TD.',
    submit: 'Email me a sign-in link',
    sending: 'Sending…',
    haveAccount: 'Already started? Sign in',
    emailMissing: 'Add your email address so we can send you a link.',
    emailInvalid: 'This email doesn’t look complete. Check it has an @ and a dot, like name@example.com.',
    codeMissing: 'Add the invite code from your message from the Porto team.',
  },

  signIn: {
    title: 'Sign in',
    heading: 'Sign in',
    intro: 'Enter the email you used to start. We’ll send you a link to sign in.',
    submit: 'Email me a sign-in link',
    sending: 'Sending…',
    noAccount: 'New to Porto? Start with an invite code',
  },

  checkEmail: {
    title: 'Check your email',
    heading: 'Check your email',
    sentTo: (email: string) => `We’ve sent a sign-in link to ${email}.`,
    sentGeneric: 'We’ve sent you a sign-in link.',
    howTo: 'Open the email and tap the link. You can open it on this device or another one.',
    expiry: 'The link works once and closes after an hour.',
    junk: 'It can take a minute to arrive. If it isn’t there, check your junk or spam folder.',
    differentEmail: 'Use a different email',
  },

  authCallback: {
    title: 'Signing in',
    signingIn: 'Signing you in…',
    expiredHeading: 'This sign-in link has closed',
    expiredBody: 'Sign-in links work once and close after an hour. Ask for a new one and use the newest email.',
    newLink: 'Send me a new link',
  },

  consent: {
    title: 'Before you start',
    heading: 'Before you start',
    intro:
      'Porto keeps what you know about your child in one place, so the people you choose can support them well. Please read how it works.',
    agreeLabel: 'I’ve read this and I agree to Porto storing this information.',
    agreeMissing: 'Tick the box to say you agree, then continue.',
    submit: 'Agree and continue',
    saving: 'Saving…',
  },

  privacy: {
    title: 'Your information',
    heading: 'How Porto looks after your information',
    version: (v: string) => `Version ${v}`,
    sections: [
      {
        heading: 'What we store',
        body: [
          'Your email address, so you can sign in.',
          'What you write about your child: a first name or nickname, how they communicate, and what helps with toileting, food and drink, overstimulation and calming.',
          'Their cues, meaning what they say or do and what it means in different places.',
          'Notes that workers send you. A note only becomes part of the profile if you add it.',
          'The links you create, when they were opened, and what workers searched for. Only you can see the searches.',
        ],
      },
      {
        heading: 'What we never store',
        body: [
          'No audio, video or photos. Porto never uses your microphone, camera or location.',
          'No surname, date of birth, address, school name or NDIS number. A nickname is fine.',
          'Please don’t add diagnoses or medical instructions. Porto is not medical advice.',
        ],
      },
      {
        heading: 'Who can see it',
        body: [
          'You, when you’re signed in.',
          'A worker you share it with, through a link you create, and only until that link closes. Links last from one shift up to 14 days. You can close any link at any time, and it stops working straight away.',
          'Our trial dashboard shows the Porto team totals only, like how many links were opened. It never shows your child’s cues, your notes or what workers searched. The small Porto team can reach the database to keep it running, and won’t read your profile unless you ask us to help.',
        ],
      },
      {
        heading: 'Where it’s kept',
        body: ['In Australia, on Supabase servers in Sydney. Porto has no advertising and no third-party tracking.'],
      },
      {
        heading: 'You’re in control',
        body: [
          'You can download everything in the profile as a file at any time.',
          'You can delete the profile and everything in it. Deleting closes every link straight away and can’t be undone.',
          'This is an early trial. If we change how your information is used, we’ll ask you again first.',
        ],
      },
    ],
    contact: (email: string) => `Questions or requests: ${email}`,
    contactMissing: 'Questions or requests: ask the Porto team member who sent your invite.',
    emergency: 'If it’s an emergency, call 000.',
  },

  start: {
    title: 'Set up',
    heading: 'One more step',
    intro: 'Enter your invite code to set up your child’s profile.',
    working: 'Setting up your profile…',
    submit: 'Set up the profile',
  },

  home: {
    title: 'Home',
    heading: 'You’re signed in',
    body: 'Next, you’ll set up your child’s profile: how they communicate, toileting, food, calming and their first cues.',
    building: 'Profile setup is the next part of Porto being built. It will appear here.',
    signOut: 'Sign out',
  },

  errors: {
    generic: 'Something went wrong on our side. What you typed is still here. Please try again in a moment.',
    offline: 'We couldn’t reach Porto just now. Check your internet connection, then try again.',
    inviteCode:
      'That code doesn’t match an unused invite. Check it against your message from the Porto team, or ask them for a new one.',
    consentFirst: 'Please read and agree to how Porto stores information first.',
    notConfigured: 'Porto isn’t connected to its database yet. The Porto team needs to finish setting it up.',
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
    loading: 'Loading…',
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
