import { useState } from 'react';
import { copy } from '../../copy/en-AU';
import { LIMITS } from '../../data/types';
import { phoneLooksValid, type WhoDraft } from '../../family/drafts';
import { WritingQuestion } from './Question';

const w = copy.card.who;

/**
 * Who a worker should ring: a first name and a number. A number that can't be right is said so
 * calmly: straight away for letters, and for a number that's too short once the family leaves the
 * box or tries to move on. It is never saved, so nothing is dropped without a word.
 */
export function WhoFields({
  draft,
  onChange,
  compact,
  level = 2,
  strict = false,
  requirePhone = false,
}: {
  draft: WhoDraft;
  onChange: (draft: WhoDraft) => void;
  /** Where adding someone is the point (the card-ready page), an empty number is said too. */
  requirePhone?: boolean;
  /** Say so about a number that's too short (set once the family has tried to move on). */
  strict?: boolean;
  compact?: boolean;
  level?: 2 | 3;
}) {
  const [left, setLeft] = useState(false);
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
        onBlur={() => setLeft(true)}
        error={
          phoneProblem(draft.who_to_call_phone, strict || left)
            ? w.phoneInvalid
            : requirePhone && strict && !draft.who_to_call_phone.trim()
              ? w.phoneMissing
              : undefined
        }
      />
    </>
  );
}

/**
 * Whether to say the number can't be right: letters or other characters at once; a number that's
 * too short only once `finished` (the family left the box or tried to move on).
 */
export function phoneProblem(phone: string, finished: boolean): boolean {
  return /[^\d\s()+-]/.test(phone) || phone.trim().length > 20 || (finished && !phoneLooksValid(phone));
}

/** What autosave stores: an unfinished number isn't saved, and the last good one stays until it's fixed. */
export function whoToSave(draft: WhoDraft, savedPhone: string): WhoDraft {
  return {
    who_to_call_name: draft.who_to_call_name.trim(),
    who_to_call_phone: phoneLooksValid(draft.who_to_call_phone) ? draft.who_to_call_phone.trim() : savedPhone,
  };
}
