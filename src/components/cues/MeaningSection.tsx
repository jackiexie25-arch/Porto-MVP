import { useId, useState, type Ref } from 'react';
import { copy } from '../../copy/en-AU';
import { CONFIDENCES, CONTEXT_TAGS, LIMITS, type ContextTag } from '../../data/types';
import { cardMeaning, contextPhrase } from '../../lib/card';
import { ChipGroup, ChoiceChip, TextArea, TextField } from '../ui';
import { toggleTag, type MeaningDraft } from './drafts';
import { MeaningView } from './MeaningView';
import { WORKER_PLACES } from './PlacePicker';
import styles from './MeaningSection.module.css';

const c = copy.cueEditor;
const f = copy.cueForm;

/** "At school", "With Grandma", or "Anywhere": the title of a meaning, as a worker reads it. */
export function placeTitle(draft: Pick<MeaningDraft, 'context_tags' | 'context_text'>): string {
  return contextPhrase(draft.context_tags, draft.context_text) || c.anywhere;
}

/** The places a worker picks come first; the rest wait behind "More places". */
const COMMON_PLACES = CONTEXT_TAGS.filter((t) => WORKER_PLACES.includes(t) && t !== 'mealtime');
const MORE_PLACES = CONTEXT_TAGS.filter((t) => !COMMON_PLACES.includes(t));

function namesSomeone(draft: MeaningDraft): boolean {
  return draft.context_tags.includes('with_person') || draft.context_tags.includes('other') || draft.context_text.trim() !== '';
}

/** Whether the place choice needs the longer list open to show what's chosen. */
function usesMorePlaces(draft: MeaningDraft): boolean {
  return draft.context_tags.some((t) => MORE_PLACES.includes(t)) || draft.context_text.trim() !== '';
}

/** "Where does it mean this?": one question, the common places first. */
function PlaceQuestion({
  draft,
  onChange,
  asked = false,
  labelledBy,
}: {
  draft: MeaningDraft;
  onChange: (draft: MeaningDraft) => void;
  /** Still the open question: nothing is chosen yet, not even "Anywhere". */
  asked?: boolean;
  /** The question is already the heading above, so the chips are named by it. */
  labelledBy?: string;
}) {
  const placeId = useId();
  const [more, setMore] = useState(() => usesMorePlaces(draft));
  const anywhere = !asked && draft.context_tags.length === 0 && !draft.context_text.trim();
  const chip = (t: ContextTag) => (
    <ChoiceChip
      key={t}
      selected={draft.context_tags.includes(t)}
      onClick={() => onChange({ ...draft, context_tags: toggleTag(draft.context_tags, t, CONTEXT_TAGS) })}
    >
      {copy.labels.context[t]}
    </ChoiceChip>
  );
  return (
    <>
      <div className={styles.group}>
        {labelledBy ? null : (
          <p id={placeId} className={styles.legend}>
            {c.placeLegend}
          </p>
        )}
        <ChipGroup aria-labelledby={labelledBy ?? placeId}>
          <ChoiceChip selected={anywhere} onClick={() => onChange({ ...draft, context_tags: [], context_text: '' })}>
            {c.anywhere}
          </ChoiceChip>
          {COMMON_PLACES.map(chip)}
          {more ? MORE_PLACES.map(chip) : null}
        </ChipGroup>
        {more ? null : (
          <button type="button" className={[styles.textButton, styles.flush].join(' ')} onClick={() => setMore(true)}>
            {c.morePlaces}
          </button>
        )}
      </div>
      {namesSomeone(draft) ? (
        <TextField
          label={c.placeTextLabel}
          hint={c.placeTextHint}
          optional
          maxLength={LIMITS.contextText}
          value={draft.context_text}
          onChange={(e) => onChange({ ...draft, context_text: e.target.value })}
        />
      ) : null}
    </>
  );
}

/**
 * One meaning of a cue. Closed, it reads exactly as a worker will see it: a quiet place line with
 * "Change" on it, then the meaning. Open, its place is the title; the words lead, and for a saved
 * meaning the place waits behind "Change where".
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
  marker,
  hints = !draft.id,
  fresh = false,
  onPlaced,
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
  /** A short note above the fields, such as where this meaning came from. */
  marker?: string;
  /** Examples under the fields. Only for a meaning the family is writing from scratch. */
  hints?: boolean;
  /**
   * A new meaning with nothing chosen: it asks "Where does it mean this?" as its heading, and the
   * place title and fields follow once a place is chosen ("Anywhere" counts).
   */
  fresh?: boolean;
  onPlaced?: () => void;
}) {
  const titleId = useId();
  const sureId = useId();
  const set = <K extends keyof MeaningDraft>(key: K, value: MeaningDraft[K]) => onChange({ ...draft, [key]: value });
  const title = placeTitle(draft);
  const sure = copy.labels.confidenceInline[draft.confidence];
  const noDo = !draft.what_to_do.trim();
  // A meaning that already has a place (saved, or set from the library or a note) keeps it folded.
  const [placeShown, setPlaceShown] = useState(() => !draft.id && draft.context_tags.length === 0 && !draft.context_text.trim());
  // Opens by itself only when something is already written in it; after that it's the person's choice.
  const [moreOpen] = useState(() => draft.what_to_avoid.trim() !== '');

  if (open && fresh) {
    return (
      <section aria-labelledby={titleId} className={[styles.section, styles.open].join(' ')}>
        <div className={styles.head}>
          <h3 ref={headingRef} tabIndex={-1} id={titleId} className={styles.title}>
            {c.placeLegend}
          </h3>
          {onRemove ? (
            <button type="button" className={styles.textButton} onClick={onRemove} aria-label={c.removeMeaningLabel(c.placeLegend)}>
              {c.removeMeaning}
            </button>
          ) : null}
        </div>
        <div className={styles.fields}>
          <PlaceQuestion
            draft={draft}
            asked
            labelledBy={titleId}
            onChange={(next) => {
              onChange(next);
              onPlaced?.();
            }}
          />
        </div>
      </section>
    );
  }

  if (!open) {
    return (
      <section aria-labelledby={titleId} className={styles.section}>
        <div className={styles.lineHead}>
          <h3 ref={headingRef} tabIndex={-1} id={titleId} className={styles.context}>
            {copy.meaning.contextLine(title, sure)}
          </h3>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => onOpenChange(true)}
            aria-label={c.changeLabel(title)}
            aria-expanded={false}
          >
            {c.change}
          </button>
        </div>
        {draft.meaning.trim() ? (
          <MeaningView meaning={cardMeaning(draft)} density="full" show={{ context: false }} />
        ) : null}
        {noDo ? <p className={styles.fact}>{copy.cues.missingDo}</p> : null}
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className={[styles.section, styles.open].join(' ')}>
      <div className={styles.head}>
        <h3 ref={headingRef} tabIndex={-1} id={titleId} className={styles.title}>
          {title}
        </h3>
        {onRemove ? (
          <button type="button" className={styles.textButton} onClick={onRemove} aria-label={c.removeMeaningLabel(title)}>
            {c.removeMeaning}
          </button>
        ) : null}
      </div>
      {marker ? <p className={styles.marker}>{marker}</p> : null}

      <div className={styles.fields}>
        {placeShown ? <PlaceQuestion draft={draft} onChange={onChange} /> : null}

        <TextArea
          ref={meaningRef}
          label={f.meaningLabel}
          hint={hints ? f.meaningHint : undefined}
          rows={2}
          maxLength={LIMITS.meaning}
          value={draft.meaning}
          onChange={(e) => set('meaning', e.target.value)}
          error={error}
        />
        <TextArea
          label={f.todoLabel}
          hint={hints ? f.todoHint : undefined}
          rows={2}
          maxLength={LIMITS.meaning}
          value={draft.what_to_do}
          onChange={(e) => set('what_to_do', e.target.value)}
        />

        {placeShown ? null : (
          <button
            type="button"
            className={[styles.textButton, styles.flush].join(' ')}
            aria-expanded={false}
            aria-label={c.changeWhereLabel(title)}
            onClick={() => setPlaceShown(true)}
          >
            {c.changeWhere}
          </button>
        )}

        <details className={styles.more} open={moreOpen || undefined}>
          <summary className={styles.summary}>
            <span className={styles.summaryText}>
              <span className={styles.summaryTitle}>{c.moreAboutMeaning}</span>
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
              hint={hints ? f.avoidHint : undefined}
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
    </section>
  );
}
