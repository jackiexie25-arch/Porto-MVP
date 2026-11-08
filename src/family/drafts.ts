import type { CardSection, CardSectionKind, CommunicationMode, LanguageStyle, Profile, ProfilePatch, SectionDraft } from '../data/types';
import { parseLanguages } from '../lib/card';

/** What the About fields edit. Languages stay as typed text until saved. */
export interface AboutDraft {
  display_name: string;
  communication_modes: CommunicationMode[];
  languagesText: string;
  language_style: LanguageStyle;
  connect_note: string;
}

export function aboutDraftFrom(profile: Profile): AboutDraft {
  return {
    display_name: profile.display_name,
    communication_modes: profile.communication_modes,
    languagesText: profile.languages.join(', '),
    language_style: profile.language_style,
    connect_note: profile.connect_note,
  };
}

export function aboutPatch(draft: AboutDraft): ProfilePatch {
  return {
    display_name: draft.display_name.trim(),
    communication_modes: draft.communication_modes,
    languages: parseLanguages(draft.languagesText),
    language_style: draft.language_style,
    connect_note: draft.connect_note.trim(),
  };
}

export function sectionDraftFrom(sections: readonly CardSection[], kind: CardSectionKind): SectionDraft {
  const found = sections.find((s) => s.section === kind);
  return { details: { ...(found?.details ?? {}) }, body: found?.body ?? '' };
}

export interface WhoDraft {
  who_to_call_name: string;
  who_to_call_phone: string;
}

export function whoDraftFrom(profile: Profile): WhoDraft {
  return { who_to_call_name: profile.who_to_call_name, who_to_call_phone: profile.who_to_call_phone };
}

/** Australian-style phone numbers: digits, spaces, brackets, a leading plus or hyphens. */
export function phoneLooksValid(phone: string): boolean {
  return phone.trim() === '' || /^\+?[\d\s()-]{6,20}$/.test(phone.trim());
}
