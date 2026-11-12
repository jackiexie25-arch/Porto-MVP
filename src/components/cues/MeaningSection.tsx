import { useId, useState, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { CONFIDENCES, CONTEXT_TAGS, LIMITS } from '../../data/types';
import { cardMeaning, contextPhrase } from '../../lib/card';
import { ChipGroup, ChoiceChip, TextArea, TextField } from '../ui';
import { toggleTag, type MeaningDraft } from './drafts';
import { MeaningView } from './MeaningView';
import styles from './MeaningSection.module.css';

const c = copy.cueEditor;
const f = copy.cueForm;

/** "At school", "With Grandma", or "Anywhere": the title of a meaning, as a worker reads it. */
export function placeTitle(draft: Pick<MeaningDraft, 'context_tags' | 'context_text'>): string {
  return contextPhrase(draft.context_tags, draft.context_text) || c.anywhere;
}

function namesSomeone(draft: MeaningDraft): boolean {
  return draft.context_tags.includes('with_person') || draft.context_tags.includes('other') || draft.context_text.trim() !== '';
}

/**
 * One meaning of a cue, titled by its place. Closed, it reads exactly as a worker will see it, with
 * one "Change" button. Open, it has the fields, and on phones a preview under them.
 */
export function MeaningSection({
  draft,
  open,
  onOpenChange,
  onChange,
  onRemove,
  error,
  meaningRef,
  headingRef,
}: {
  draft: MeaningDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (draft: MeaningDraft) => void;
  /** Absent when this is the only meaning: a cue always means something. */
  onRemove?: () => void;
  error?: string;
  meaningRef?: Ref<HTMLTextAreaElement>;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const titleId = useId();
  const placeId = useId();
  const sureId = useId();
  const set = <K extends keyof MeaningDraft>(key: K, value: MeaningDraft[K]) => onChange({ ...draft, [key]: value });
  const title = placeTitle(draft);
  const anywhere = draft.context_tags.length === 0 && !draft.context_text.trim();
  const sure = copy.labels.confidenceInline[draft.confidence];
  const noDo = !draft.what_to_do.trim();
  // Opens by itself only when something is already written in it; after that it's the person's choice.
  const [moreOpen] = useState(() => draft.what_to_avoid.trim() !== '');

  return (
    <section aria-labelledby={titleId} className={[styles.section, open ? styles.open : ''].join(' ')}>
      <div className={styles.head}>
        <h3 ref={headingRef} tabIndex={-1} className={styles.title}>
          <span id={titleId}>{title}</span>
          {!open ? <span className={styles.sure}> · {sure}</span> : null}
        </h3>
        {open ? (
          onRemove ? (
            <button type="button" className={styles.textButton} onClick={onRemove} aria-label={c.removeMeaningLabel(title)}>
              {c.removeMeaning}
            </button>
          ) : null
        ) : (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onOpenChange(true)}
            aria-label={c.changeLabel(title)}
            aria-expanded={false}
          >
            {c.change}
          </button>
        )}
      </div>

      {!open ? (
        <div className={styles.reads}>
          {draft.meaning.trim() ? (
            <MeaningView meaning={cardMeaning(draft)} density="full" show={{ context: false }} />
          ) : null}
          {noDo ? <p className={styles.fact}>{copy.cues.missingDo}</p> : null}
        </div>
      ) : (
        <div className={styles.fields}>
          <div className={styles.group}>
            <p id={placeId} className={styles.legend}>
              {c.placeLegend}
            </p>
            <ChipGroup aria-labelledby={placeId}>
              <ChoiceChip selected={anywhere} onClick={() => onChange({ ...draft, context_tags: [], context_text: '' })}>
                {c.anywhere}
              </ChoiceChip>
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

          {namesSomeone(draft) ? (
            <TextField
              label={c.placeTextLabel}
              hint={c.placeTextHint}
              optional
              maxLength={LIMITS.contextText}
              value={draft.context_text}
              onChange={(e) => set('context_text', e.target.value)}
            />
          ) : null}

          <TextArea
            ref={meaningRef}
            label={f.meaningLabel}
            hint={f.meaningHint}
            rows={2}
            maxLength={LIMITS.meaning}
            value={draft.meaning}
            onChange={(e) => set('meaning', e.target.value)}
            error={error}
          />
          <TextArea
            label={f.todoLabel}
            hint={f.todoHint}
            rows={2}
            maxLength={LIMITS.meaning}
            value={draft.what_to_do}
            onChange={(e) => set('what_to_do', e.target.value)}
          />

          <details className={styles.more} open={moreOpen || undefined}>
            <summary className={styles.summary}>
              <span className={styles.summaryText}>
                <span className={styles.summaryTitle}>{c.moreDetail}</span>
                <span className={styles.summaryHint}>{c.meaningMoreHint(sure)}</span>
              </span>
              <span className={styles.fold} aria-hidden="true">
                <span className={styles.whenClosed}>{c.show}</span>
                <span className={styles.whenOpen}>{c.hide}</span>
              </span>
            </summary>
            <div className={styles.moreBody}>
              <TextArea
                label={f.avoidLabel}
                hint={f.avoidHint}
                optional
                rows={2}
                maxLength={LIMITS.meaning}
                value={draft.what_to_avoid}
                onChange={(e) => set('what_to_avoid', e.target.value)}
              />
              <div className={styles.group}>
                <p id={sureId} className={styles.legend}>
                  {f.confidenceLegend}
                </p>
                <ChipGroup aria-labelledby={sureId}>
                  {CONFIDENCES.map((k) => (
                    <ChoiceChip key={k} selected={draft.confidence === k} onClick={() => set('confidence', k)}>
                      {copy.labels.confidence[k]}
                    </ChoiceChip>
                  ))}
                </ChipGroup>
              </div>
            </div>
          </details>

          {draft.meaning.trim() ? (
            <div className={styles.here}>
              <p className={styles.hereLabel}>{c.previewHere}</p>
              <MeaningView meaning={cardMeaning(draft)} density="full" inContext />
            </div>
          ) : null}

          <div>
            <button
              type="button"
              className={[styles.textButton, styles.done].join(' ')}
              onClick={() => onOpenChange(false)}
              aria-label={c.doneLabel(title)}
            >
              {c.done}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
