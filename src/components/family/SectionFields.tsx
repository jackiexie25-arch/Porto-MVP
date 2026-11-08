import { copy } from '../../copy/en-AU';
import { LIMITS, SECTION_DETAIL_KEYS, type CardSectionKind, type SectionDraft } from '../../data/types';
import { FieldStack, TextArea } from '../ui';

interface Prompt {
  label: string;
  hint: string;
}

/** The setup prompts for one card section. Calms and avoid have one answer; the rest have two or three. */
export function SectionFields({
  section,
  draft,
  onChange,
}: {
  section: CardSectionKind;
  draft: SectionDraft;
  onChange: (draft: SectionDraft) => void;
}) {
  if (section === 'calms' || section === 'avoid') {
    const prompt: Prompt = copy.sectionFields[section];
    return (
      <TextArea
        label={prompt.label}
        hint={prompt.hint}
        maxLength={LIMITS.detail}
        value={draft.body}
        onChange={(e) => onChange({ ...draft, body: e.target.value })}
      />
    );
  }

  const prompts = copy.sectionFields[section] as Record<string, Prompt>;
  return (
    <FieldStack>
      {SECTION_DETAIL_KEYS[section].map((key) => (
        <TextArea
          key={key}
          label={prompts[key]!.label}
          hint={prompts[key]!.hint}
          maxLength={LIMITS.detail}
          value={draft.details[key] ?? ''}
          onChange={(e) => onChange({ ...draft, details: { ...draft.details, [key]: e.target.value } })}
        />
      ))}
    </FieldStack>
  );
}
