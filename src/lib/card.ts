import { copy } from '../copy/en-AU';
import {
  SECTION_DETAIL_KEYS,
  type CardSection,
  type CardSectionKind,
  type Confidence,
  type ContextTag,
  type Cue,
  type Profile,
} from '../data/types';

export const WORDS_PER_MINUTE = 200;
export const LONG_CARD_WORDS = 350;
export const MAX_ABOUT_LINES = 3;

export interface CardLine {
  /** Worker-facing label, such as "What to do". Absent for single-answer sections. */
  label?: string;
  text: string;
}

export interface CardBlock {
  key: CardSectionKind;
  title: string;
  lines: CardLine[];
}

export interface CardCueMeaning {
  context: string;
  meaning: string;
  whatToDo: string;
  whatToAvoid: string;
  confidence: Confidence;
}

export interface CardCue {
  id: string;
  label: string;
  meanings: CardCueMeaning[];
}

export interface CardModel {
  name: string;
  about: string[];
  /** Always in the fixed order; a section with no lines is still listed so families can fill it. */
  sections: CardBlock[];
  cues: CardCue[];
  whoToCall: { name: string; phone: string } | null;
  updatedAt: string;
}

/** "sounds, gestures and an AAC device" */
export function joinList(items: readonly string[], conjunction = 'and'): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "At home or at mealtimes", "With Grandma", or "" when no context is given. */
export function contextPhrase(tags: readonly ContextTag[], text: string): string {
  const parts: string[] = tags
    .filter((t) => !(t === 'other' && text.trim()))
    .map((t) => copy.labels.contextPhrase[t]);
  if (text.trim()) parts.push(text.trim());
  return parts.length ? capitalise(joinList(parts, 'or')) : '';
}

function aboutLines(profile: Profile): string[] {
  const lines: string[] = [];
  if (profile.communication_modes.length) {
    lines.push(
      copy.card.about.communicates(joinList(profile.communication_modes.map((m) => copy.labels.communicationInline[m]))),
    );
  }
  if (profile.languages.length) lines.push(copy.card.about.languages(joinList(profile.languages)));
  if (profile.connect_note.trim()) lines.push(profile.connect_note.trim());
  return lines.slice(0, MAX_ABOUT_LINES);
}

function sectionLines(kind: CardSectionKind, section: CardSection | undefined): CardLine[] {
  if (!section) return [];
  if (kind === 'calms' || kind === 'avoid') {
    return section.body.trim() ? [{ text: section.body.trim() }] : [];
  }
  const fields = copy.sectionFields[kind] as Record<string, { worker: string }>;
  return SECTION_DETAIL_KEYS[kind]
    .map((key) => ({ label: fields[key]!.worker, text: (section.details[key] ?? '').trim() }))
    .filter((line) => line.text !== '');
}

const ORDER: readonly CardSectionKind[] = ['toileting', 'food_drink', 'overstimulation', 'calms', 'avoid'];

export function pinnedCues(cues: readonly Cue[]): Cue[] {
  return cues
    .filter((c) => c.pinned)
    .sort((a, b) => (a.pin_order ?? 99) - (b.pin_order ?? 99) || a.created_at.localeCompare(b.created_at))
    .slice(0, 5);
}

export function buildCard(profile: Profile, sections: readonly CardSection[], cues: readonly Cue[], fallbackName: string): CardModel {
  const byKind = new Map(sections.map((s) => [s.section, s]));
  const pinned = pinnedCues(cues);
  const stamps = [profile.updated_at, ...sections.map((s) => s.updated_at), ...pinned.map((c) => c.updated_at)];

  return {
    name: profile.display_name.trim() || fallbackName,
    about: aboutLines(profile),
    sections: ORDER.map((key) => ({
      key,
      title: copy.card.sections[key],
      lines: sectionLines(key, byKind.get(key)),
    })),
    cues: pinned.map((cue) => ({
      id: cue.id,
      label: cue.label,
      meanings: cue.cue_meanings.map((m) => ({
        context: contextPhrase(m.context_tags, m.context_text),
        meaning: m.meaning,
        whatToDo: m.what_to_do,
        whatToAvoid: m.what_to_avoid,
        confidence: m.confidence,
      })),
    })),
    whoToCall: profile.who_to_call_phone.trim()
      ? { name: profile.who_to_call_name.trim(), phone: profile.who_to_call_phone.trim() }
      : null,
    updatedAt: stamps.reduce((latest, s) => (s > latest ? s : latest), profile.updated_at),
  };
}

/** Every word a worker reads on the card, including headings and labels. */
export function cardText(model: CardModel): string {
  const parts: string[] = [];
  if (model.about.length) parts.push(copy.card.sections.about(model.name), ...model.about);
  for (const block of model.sections) {
    if (!block.lines.length) continue;
    parts.push(block.title, ...block.lines.flatMap((l) => (l.label ? [l.label, l.text] : [l.text])));
  }
  if (model.cues.length) parts.push(copy.card.sections.cues);
  for (const cue of model.cues) {
    parts.push(cue.label);
    for (const m of cue.meanings) {
      parts.push(m.context, m.meaning, m.whatToDo, m.whatToAvoid, copy.labels.confidence[m.confidence]);
    }
  }
  if (model.whoToCall) parts.push(copy.card.sections.who, model.whoToCall.name, model.whoToCall.phone);
  return parts.filter(Boolean).join(' ');
}

export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function isEmptyCard(model: CardModel): boolean {
  return !model.about.length && model.sections.every((s) => !s.lines.length) && !model.cues.length && !model.whoToCall;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Splits "English, Auslan , ,Mandarin" into clean entries. */
export function parseLanguages(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 40))
    .slice(0, 10);
}
