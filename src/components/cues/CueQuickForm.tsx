import { useEffect, useRef, useState, type FormEvent, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { LIMITS, type ContextTag, type NewCue, type NewMeaning } from '../../data/types';
import { friendlyError } from '../../lib/errors';
import { reveal, useRevealOn } from '../../lib/reveal';
import { ChoiceQuestion, WritingQuestion } from '../family/Question';
import { Banner, Button, ChipGroup, ChoiceChip } from '../ui';
import { toggleTag } from './drafts';
import { WORKER_PLACES } from './PlacePicker';
import styles from './CueQuickForm.module.css';

const c = copy.cueForm;
const s = copy.setup.cues;

export type StarterKind = 'phrase' | 'sound' | 'gesture';

export interface QuickDraft {
  cue_type: StarterKind;
  label: string;
  /** Empty means anywhere. */
  context_tags: ContextTag[];
  meaning: string;
  what_to_do: string;
}

export function emptyQuickDraft(cue_type: StarterKind = 'phrase'): QuickDraft {
  return { cue_type, label: '', context_tags: [], meaning: '', what_to_do: '' };
}

/** Anything typed or chosen that would be lost if the form closed. The kind alone doesn't count. */
export function isQuickDraftDirty(d: QuickDraft): boolean {
  return [d.label, d.meaning, d.what_to_do].some((v) => v.trim() !== '') || d.context_tags.length > 0;
}

/** The cue and its first meaning, as saved. Setup asks only what a worker most needs. */
export function quickDraftToCue(d: QuickDraft): { cue: NewCue; meaning: NewMeaning } {
  return {
    cue: { label: d.label.trim(), cue_type: d.cue_type, category: 'other' },
    meaning: {
      context_tags: d.context_tags,
      context_text: '',
      meaning: d.meaning.trim(),
      what_to_do: d.what_to_do.trim(),
      what_to_avoid: '',
      confidence: 'usually',
    },
  };
}

/**
 * Add one cue in setup, as four short questions: what you see or hear, where, what it means and
 * what to do. More detail (avoid, how sure, other places) lives in the cue library.
 */
export function CueQuickForm({
  onAdd,
  formRef,
  onDraftChange,
  onInvalid,
}: {
  onAdd: (cue: NewCue, meaning: NewMeaning) => Promise<unknown>;
  /** Lets a parent submit the form, for example from "Save and continue". */
  formRef?: Ref<HTMLFormElement>;
  /** So the step knows if a typed cue would be lost, and what it's called. */
  onDraftChange?: (draft: QuickDraft) => void;
  onInvalid?: () => void;
}) {
  const [draft, setDraft] = useState(() => emptyQuickDraft());
  const [errors, setErrors] = useState<{ label?: string; meaning?: string; form?: string }>({});
  const [adding, setAdding] = useState(false);
  const labelRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const meaningRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const formErrorRef = useRevealOn<HTMLDivElement>(errors.form);
  const set = <K extends keyof QuickDraft>(key: K, value: QuickDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = {
      ...(draft.label.trim() ? {} : { label: c.labelMissing }),
      ...(draft.meaning.trim() ? {} : { meaning: c.meaningMissing }),
    };
    setErrors(found);
    if (found.label || found.meaning) {
      onInvalid?.();
      return reveal(found.label ? labelRef.current : meaningRef.current);
    }
    setAdding(true);
    try {
      const { cue, meaning } = quickDraftToCue(draft);
      await onAdd(cue, meaning);
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
      {errors.form ? (
        <Banner tone="error" ref={formErrorRef}>
          {errors.form}
        </Banner>
      ) : null}
      <ChoiceQuestion question={s.kindLegend}>
        <ChipGroup>
          {s.kinds.map((kind) => (
            <ChoiceChip key={kind.type} selected={draft.cue_type === kind.type} onClick={() => set('cue_type', kind.type as StarterKind)}>
              {kind.label}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </ChoiceQuestion>
      <WritingQuestion
        key={draft.cue_type}
        question={s.seeLabel}
        example={s.seeExamples[draft.cue_type]}
        multiline={false}
        maxLength={LIMITS.cueLabel}
        value={draft.label}
        onChange={(v) => set('label', v)}
        error={errors.label}
        inputRef={labelRef}
      />
      <ChoiceQuestion question={s.whereLegend} hint={s.whereHint}>
        <ChipGroup>
          <ChoiceChip selected={draft.context_tags.length === 0} onClick={() => set('context_tags', [])}>
            {copy.cueEditor.anywhere}
          </ChoiceChip>
          {WORKER_PLACES.map((place) => (
            <ChoiceChip
              key={place}
              selected={draft.context_tags.includes(place)}
              onClick={() => set('context_tags', toggleTag(draft.context_tags, place, WORKER_PLACES))}
            >
              {copy.labels.context[place]}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </ChoiceQuestion>
      <WritingQuestion
        question={s.meaningLabel}
        example={s.meaningExample}
        maxLength={LIMITS.meaning}
        value={draft.meaning}
        onChange={(v) => set('meaning', v)}
        error={errors.meaning}
        inputRef={meaningRef}
      />
      <WritingQuestion
        question={s.doLabel}
        example={s.doExample}
        maxLength={LIMITS.meaning}
        value={draft.what_to_do}
        onChange={(v) => set('what_to_do', v)}
      />
      <div className={styles.submit}>
        <Button type="submit" variant="outlined" disabled={adding}>
          {adding ? c.adding : s.add}
        </Button>
      </div>
    </form>
  );
}
