import { useId } from 'react';
import { copy } from '../../copy/en-AU';
import { COMMUNICATION_MODES, LIMITS } from '../../data/types';
import type { AboutDraft } from '../../family/drafts';
import { Checkbox } from '../ui';
import fieldStyles from '../ui/Field.module.css';
import { ChoiceQuestion, WritingQuestion } from './Question';

const c = copy.setup.about;

/** "your child is autistic" → "Your child is autistic", when there's no name yet. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The basics, asked one question at a time. Once the name is in, every later question uses it.
 * `compact` sets the questions smaller, for changing the card in place.
 */
export function AboutFields({
  draft,
  onChange,
  compact,
  level = 2,
}: {
  draft: AboutDraft;
  onChange: (draft: AboutDraft) => void;
  compact?: boolean;
  level?: 2 | 3;
}) {
  const id = useId();
  const name = draft.display_name.trim() || copy.setup.yourChild;
  const set = <K extends keyof AboutDraft>(key: K, value: AboutDraft[K]) => onChange({ ...draft, [key]: value });
  const look = { compact, level };

  return (
    <>
      <WritingQuestion
        {...look}
        question={c.nameLabel}
        hint={c.nameHint}
        multiline={false}
        maxLength={LIMITS.name}
        value={draft.display_name}
        onChange={(v) => set('display_name', v)}
      />
      <ChoiceQuestion {...look} question={c.modesLegend(name)} hint={c.modesHint}>
        {COMMUNICATION_MODES.map((mode) => (
          <Checkbox
            key={mode}
            label={copy.labels.communication[mode]}
            checked={draft.communication_modes.includes(mode)}
            onChange={(e) =>
              set(
                'communication_modes',
                e.target.checked
                  ? COMMUNICATION_MODES.filter((m) => m === mode || draft.communication_modes.includes(m))
                  : draft.communication_modes.filter((m) => m !== mode),
              )
            }
          />
        ))}
      </ChoiceQuestion>
      <WritingQuestion
        {...look}
        question={c.languagesLabel(name)}
        hint={c.languagesHint}
        multiline={false}
        maxLength={LIMITS.languagesText}
        value={draft.languagesText}
        onChange={(v) => set('languagesText', v)}
      />
      <ChoiceQuestion {...look} question={c.styleLegend(name)} hint={c.styleHint}>
        {(['identity_first', 'person_first'] as const).map((value) => (
          <div key={value} className={fieldStyles.checkRow}>
            <input
              id={`${id}-${value}`}
              type="radio"
              name={`${id}-language-style`}
              className={fieldStyles.checkbox}
              checked={draft.language_style === value}
              onChange={() => set('language_style', value)}
            />
            <label htmlFor={`${id}-${value}`} className={fieldStyles.checkLabel}>
              {sentence(value === 'identity_first' ? c.styleIdentity(name) : c.stylePerson(name))}
            </label>
          </div>
        ))}
      </ChoiceQuestion>
      <WritingQuestion
        {...look}
        question={c.connectLabel(name)}
        hint={c.connectHint}
        example={c.connectExample}
        maxLength={LIMITS.connectNote}
        value={draft.connect_note}
        onChange={(v) => set('connect_note', v)}
      />
    </>
  );
}
