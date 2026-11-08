import { useEffect, useRef, useState, type FormEvent, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { CUE_CATEGORIES, LIMITS, type CueCategory, type CueType, type NewCue, type NewMeaning } from '../../data/types';
import { friendlyError } from '../../lib/errors';
import { Banner, Button, FieldStack, Select, TextField } from '../ui';
import { emptyMeaning, toMeaningInput, type MeaningDraft } from './drafts';
import { CueTypeChips, MeaningFields } from './MeaningFields';
import styles from './CueQuickForm.module.css';

const c = copy.cueForm;

interface QuickDraft {
  label: string;
  cue_type: CueType;
  category: CueCategory;
  meaning: MeaningDraft;
}

function emptyQuickDraft(cue_type: CueType): QuickDraft {
  return { label: '', cue_type, category: 'other', meaning: emptyMeaning() };
}

export function isQuickDraftDirty(d: QuickDraft): boolean {
  const m = d.meaning;
  return (
    [d.label, m.meaning, m.what_to_do, m.what_to_avoid, m.context_text].some((v) => v.trim() !== '') ||
    m.context_tags.length > 0
  );
}

/** Add one cue with its first meaning, in context. Used in setup step 5. */
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
  const [draft, setDraft] = useState(() => emptyQuickDraft(initialType));
  const [errors, setErrors] = useState<{ label?: string; meaning?: string; form?: string }>({});
  const [adding, setAdding] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const meaningRef = useRef<HTMLTextAreaElement>(null);

  const dirty = isQuickDraftDirty(draft);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      ...(draft.label.trim() ? {} : { label: c.labelMissing }),
      ...(draft.meaning.meaning.trim() ? {} : { meaning: c.meaningMissing }),
    };
    setErrors(found);
    if (found.label || found.meaning) {
      onInvalid?.();
      return (found.label ? labelRef.current : meaningRef.current)?.focus();
    }
    setAdding(true);
    try {
      await onAdd(
        { label: draft.label.trim(), cue_type: draft.cue_type, category: draft.category },
        toMeaningInput(draft.meaning),
      );
      setDraft(emptyQuickDraft(draft.cue_type));
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
        <CueTypeChips value={draft.cue_type} onChange={(cue_type) => setDraft((d) => ({ ...d, cue_type }))} />
        <TextField
          ref={labelRef}
          label={c.labelLabel}
          hint={c.labelHints[draft.cue_type]}
          maxLength={LIMITS.cueLabel}
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
          error={errors.label}
        />
        <Select
          label={c.categoryLabel}
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as CueCategory }))}
          options={CUE_CATEGORIES.map((k) => ({ value: k, label: copy.labels.category[k] }))}
        />
        <MeaningFields
          draft={draft.meaning}
          onChange={(meaning) => setDraft((d) => ({ ...d, meaning }))}
          error={errors.meaning}
          meaningRef={meaningRef}
        />
      </FieldStack>
      <div>
        <Button type="submit" variant="outlined" disabled={adding}>
          {adding ? c.adding : c.submit}
        </Button>
      </div>
    </form>
  );
}
