import { useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import {
  CONFIDENCES,
  CONTEXT_TAGS,
  CUE_CATEGORIES,
  CUE_TYPES,
  LIMITS,
  type Confidence,
  type ContextTag,
  type CueCategory,
  type CueType,
  type NewCue,
  type NewMeaning,
} from '../../data/types';
import { friendlyError } from '../../lib/errors';
import { Banner, Button, ChipGroup, ChoiceChip, FieldStack, Select, TextArea, TextField } from '../ui';
import styles from './CueQuickForm.module.css';

const c = copy.cueForm;

export interface CueQuickDraft {
  label: string;
  cue_type: CueType;
  category: CueCategory;
  context_tags: ContextTag[];
  context_text: string;
  meaning: string;
  what_to_do: string;
  what_to_avoid: string;
  confidence: Confidence;
}

export function emptyCueDraft(cue_type: CueType = 'phrase'): CueQuickDraft {
  return {
    label: '',
    cue_type,
    category: 'other',
    context_tags: [],
    context_text: '',
    meaning: '',
    what_to_do: '',
    what_to_avoid: '',
    confidence: 'usually',
  };
}

export function validateCue(draft: CueQuickDraft): { label?: string; meaning?: string } {
  return {
    ...(draft.label.trim() ? {} : { label: c.labelMissing }),
    ...(draft.meaning.trim() ? {} : { meaning: c.meaningMissing }),
  };
}

export function splitCueDraft(draft: CueQuickDraft): { cue: NewCue; meaning: NewMeaning } {
  return {
    cue: { label: draft.label.trim(), cue_type: draft.cue_type, category: draft.category },
    meaning: {
      context_tags: draft.context_tags,
      context_text: draft.context_text.trim(),
      meaning: draft.meaning.trim(),
      what_to_do: draft.what_to_do.trim(),
      what_to_avoid: draft.what_to_avoid.trim(),
      confidence: draft.confidence,
    },
  };
}

export function isCueDraftDirty(draft: CueQuickDraft): boolean {
  return (
    [draft.label, draft.meaning, draft.what_to_do, draft.what_to_avoid, draft.context_text].some((v) => v.trim()) ||
    draft.context_tags.length > 0
  );
}

/** Add one cue with its first meaning, in context. */
export function CueQuickForm({
  initialType,
  onAdd,
  formRef,
  onDirtyChange,
  onInvalid,
}: {
  initialType: CueType;
  onAdd: (cue: NewCue, meaning: NewMeaning) => Promise<unknown>;
  /** Lets a parent submit the form, for example from "Save and continue". */
  formRef?: Ref<HTMLFormElement>;
  onDirtyChange?: (dirty: boolean) => void;
  onInvalid?: () => void;
}) {
  const [draft, setDraft] = useState(() => emptyCueDraft(initialType));
  const dirty = isCueDraftDirty(draft);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const [errors, setErrors] = useState<{ label?: string; meaning?: string; form?: string }>({});
  const [adding, setAdding] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const meaningRef = useRef<HTMLTextAreaElement>(null);
  const typeId = useId();
  const contextId = useId();
  const confidenceId = useId();

  const set = <K extends keyof CueQuickDraft>(key: K, value: CueQuickDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateCue(draft);
    setErrors(found);
    if (found.label || found.meaning) {
      onInvalid?.();
      return (found.label ? labelRef.current : meaningRef.current)?.focus();
    }
    setAdding(true);
    try {
      const { cue, meaning } = splitCueDraft(draft);
      await onAdd(cue, meaning);
      setDraft(emptyCueDraft(draft.cue_type));
    } catch (err) {
      setErrors({ form: friendlyError(err) });
      onInvalid?.();
    } finally {
      setAdding(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className={styles.form}>
      {errors.form ? <Banner tone="error">{errors.form}</Banner> : null}
      <FieldStack>
        <div className={styles.group}>
          <p id={typeId} className={styles.legend}>
            {c.typeLegend}
          </p>
          <ChipGroup aria-labelledby={typeId}>
            {CUE_TYPES.map((t) => (
              <ChoiceChip key={t} selected={draft.cue_type === t} onClick={() => set('cue_type', t)}>
                {copy.labels.cueType[t]}
              </ChoiceChip>
            ))}
          </ChipGroup>
        </div>

        <TextField
          ref={labelRef}
          label={c.labelLabel}
          hint={c.labelHints[draft.cue_type]}
          maxLength={LIMITS.cueLabel}
          value={draft.label}
          onChange={(e) => set('label', e.target.value)}
          error={errors.label}
        />

        <Select
          label={c.categoryLabel}
          value={draft.category}
          onChange={(e) => set('category', e.target.value as CueCategory)}
          options={CUE_CATEGORIES.map((k) => ({ value: k, label: copy.labels.category[k] }))}
        />

        <div className={styles.group}>
          <p id={contextId} className={styles.legend}>
            {c.contextLegend}
          </p>
          <p className={styles.hint}>{c.contextHint}</p>
          <ChipGroup aria-labelledby={contextId}>
            {CONTEXT_TAGS.map((t) => {
              const selected = draft.context_tags.includes(t);
              return (
                <ChoiceChip
                  key={t}
                  selected={selected}
                  onClick={() =>
                    set(
                      'context_tags',
                      selected ? draft.context_tags.filter((x) => x !== t) : CONTEXT_TAGS.filter((x) => x === t || draft.context_tags.includes(x)),
                    )
                  }
                >
                  {copy.labels.context[t]}
                </ChoiceChip>
              );
            })}
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
          error={errors.meaning}
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
      <div>
        <Button type="submit" variant="outlined" disabled={adding}>
          {adding ? c.adding : c.submit}
        </Button>
      </div>
    </form>
  );
}
