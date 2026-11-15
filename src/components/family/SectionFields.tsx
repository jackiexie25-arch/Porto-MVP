import { copy } from '../../copy/en-AU';
import { LIMITS, SECTION_DETAIL_KEYS, type CardSectionKind, type SectionDraft } from '../../data/types';
import { WritingQuestion } from './Question';

interface Prompt {
  ask: (name: string) => string;
  example: string;
}

/**
 * The questions for one card section, asked with the child's name. Calms and avoid have one
 * answer; the rest have two or three.
 */
export function SectionFields({
  section,
  draft,
  onChange,
  name,
  compact,
  level = 2,
}: {
  section: CardSectionKind;
  draft: SectionDraft;
  onChange: (draft: SectionDraft) => void;
  /** The child's name, or "your child". */
  name: string;
  compact?: boolean;
  level?: 2 | 3;
}) {
  const look = { compact, level };
  if (section === 'calms' || section === 'avoid') {
    const prompt: Prompt = copy.sectionFields[section];
    return (
      <WritingQuestion
        {...look}
        question={prompt.ask(name)}
        example={prompt.example}
        maxLength={LIMITS.detail}
        value={draft.body}
        onChange={(body) => onChange({ ...draft, body })}
      />
    );
  }

  const prompts = copy.sectionFields[section] as Record<string, Prompt>;
  return (
    <>
      {SECTION_DETAIL_KEYS[section].map((key) => (
        <WritingQuestion
          {...look}
          key={key}
          question={prompts[key]!.ask(name)}
          example={prompts[key]!.example}
          maxLength={LIMITS.detail}
          value={draft.details[key] ?? ''}
          onChange={(v) => onChange({ ...draft, details: { ...draft.details, [key]: v } })}
        />
      ))}
    </>
  );
}
