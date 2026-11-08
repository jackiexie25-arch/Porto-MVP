import { useId, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { CONFIDENCES, CONTEXT_TAGS, CUE_TYPES, LIMITS, type CueType } from '../../data/types';
import { ChipGroup, ChoiceChip, FieldStack, TextArea, TextField } from '../ui';
import { toggleTag, type MeaningDraft } from './drafts';
import styles from './CueQuickForm.module.css';

const c = copy.cueForm;

/** Where a cue means this, what it means, what to do and avoid, and how sure the family is. */
export function MeaningFields({
  draft,
  onChange,
  error,
  meaningRef,
}: {
  draft: MeaningDraft;
  onChange: (draft: MeaningDraft) => void;
  error?: string;
  meaningRef?: Ref<HTMLTextAreaElement>;
}) {
  const contextId = useId();
  const confidenceId = useId();
  const set = <K extends keyof MeaningDraft>(key: K, value: MeaningDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <FieldStack>
      <div className={styles.group}>
        <p id={contextId} className={styles.legend}>
          {c.contextLegend}
        </p>
        <p className={styles.hint}>{c.contextHint}</p>
        <ChipGroup aria-labelledby={contextId}>
          {CONTEXT_TAGS.map((t) => (
            <ChoiceChip
              key={t}
              selected={draft.context_tags.includes(t)}
              onClick={() => set('context_tags', toggleTag(draft.context_tags, t, CONTEXT_TAGS))}
            >
              {copy.labels.context[t]}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </div>

      <TextField
        label={c.contextTextLabel}
        hint={c.contextTextHint}
        optional
        maxLength={LIMITS.contextText}
        value={draft.context_text}
        onChange={(e) => set('context_text', e.target.value)}
      />
      <TextArea
        ref={meaningRef}
        label={c.meaningLabel}
        hint={c.meaningHint}
        rows={2}
        maxLength={LIMITS.meaning}
        value={draft.meaning}
        onChange={(e) => set('meaning', e.target.value)}
        error={error}
      />
      <TextArea
        label={c.todoLabel}
        hint={c.todoHint}
        rows={2}
        maxLength={LIMITS.meaning}
        value={draft.what_to_do}
        onChange={(e) => set('what_to_do', e.target.value)}
      />
      <TextArea
        label={c.avoidLabel}
        hint={c.avoidHint}
        optional
        rows={2}
        maxLength={LIMITS.meaning}
        value={draft.what_to_avoid}
        onChange={(e) => set('what_to_avoid', e.target.value)}
      />

      <div className={styles.group}>
        <p id={confidenceId} className={styles.legend}>
          {c.confidenceLegend}
        </p>
        <ChipGroup aria-labelledby={confidenceId}>
          {CONFIDENCES.map((k) => (
            <ChoiceChip key={k} selected={draft.confidence === k} onClick={() => set('confidence', k)}>
              {copy.labels.confidence[k]}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </div>
    </FieldStack>
  );
}

/** Single choice of cue type, as chips. */
export function CueTypeChips({ value, onChange }: { value: CueType; onChange: (value: CueType) => void }) {
  const id = useId();
  return (
    <div className={styles.group}>
      <p id={id} className={styles.legend}>
        {c.typeLegend}
      </p>
      <ChipGroup aria-labelledby={id}>
        {CUE_TYPES.map((t) => (
          <ChoiceChip key={t} selected={value === t} onClick={() => onChange(t)}>
            {copy.labels.cueType[t]}
          </ChoiceChip>
        ))}
      </ChipGroup>
    </div>
  );
}
