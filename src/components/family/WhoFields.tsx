import { copy } from '../../copy/en-AU';
import { LIMITS } from '../../data/types';
import { phoneLooksValid, type WhoDraft } from '../../family/drafts';
import { WritingQuestion } from './Question';

const w = copy.card.who;

/** Who a worker should ring: a first name and a number. */
export function WhoFields({
  draft,
  onChange,
  compact,
  level = 2,
  strict = false,
}: {
  draft: WhoDraft;
  onChange: (draft: WhoDraft) => void;
  /** Also say so about a number that's too short, once the family has tried to move on. */
  strict?: boolean;
  compact?: boolean;
  level?: 2 | 3;
}) {
  const look = { compact, level };
  return (
    <>
      <WritingQuestion
        {...look}
        question={w.nameLabel}
        hint={w.nameHint}
        multiline={false}
        maxLength={LIMITS.name}
        value={draft.who_to_call_name}
        onChange={(who_to_call_name) => onChange({ ...draft, who_to_call_name })}
      />
      <WritingQuestion
        {...look}
        question={w.phoneLabel}
        hint={w.note}
        multiline={false}
        type="tel"
        inputMode="tel"
        maxLength={LIMITS.phone}
        value={draft.who_to_call_phone}
        onChange={(who_to_call_phone) => onChange({ ...draft, who_to_call_phone })}
        error={
          phoneHasWrongCharacters(draft.who_to_call_phone) || (strict && !phoneLooksValid(draft.who_to_call_phone))
            ? w.phoneInvalid
            : undefined
        }
      />
    </>
  );
}

/**
 * Says so only when something other than a phone number is typed, never while a number is still
 * being typed (a half-typed number simply isn't saved yet).
 */
export function phoneHasWrongCharacters(phone: string): boolean {
  return /[^\d\s()+-]/.test(phone) || phone.trim().length > 20;
}

/** What autosave stores: an unfinished number isn't saved, and the last good one stays until it's fixed. */
export function whoToSave(draft: WhoDraft, savedPhone: string): WhoDraft {
  return {
    who_to_call_name: draft.who_to_call_name.trim(),
    who_to_call_phone: phoneLooksValid(draft.who_to_call_phone) ? draft.who_to_call_phone.trim() : savedPhone,
  };
}
