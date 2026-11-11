import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Banner, Button, ChipGroup, ChoiceChip, FieldStack, Select, TextArea, TextField } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { friendlyError } from '../lib/errors';
import { reveal, useRevealOn } from '../lib/reveal';
import type { WorkerNote, WorkerSource } from './types';
import styles from './Worker.module.css';

const l = copy.worker.log;
const MAX = 500;

type Outcome = WorkerNote['outcome'];

export interface LogDraft {
  cueId: string;
  cueText: string;
  seemedToNeed: string;
  contextTags: ContextTag[];
  contextText: string;
  tried: string;
  outcome: Outcome | null;
  workerName: string;
}

export function emptyLog(cueText = '', context: ContextTag | null = null): LogDraft {
  return {
    cueId: '',
    cueText,
    seemedToNeed: '',
    contextTags: context ? [context] : [],
    contextText: '',
    tried: '',
    outcome: null,
    workerName: '',
  };
}

export function validateLog(d: LogDraft): { cue?: string; outcome?: string } {
  return {
    ...(d.cueId || d.cueText.trim() ? {} : { cue: l.missingCue }),
    ...(d.outcome ? {} : { outcome: l.missingOutcome }),
  };
}

export function toWorkerNote(d: LogDraft): WorkerNote {
  return {
    cue_id: d.cueId || null,
    cue_text: d.cueText.trim(),
    context_tags: d.contextTags,
    context_text: d.contextText.trim(),
    tried: d.tried.trim(),
    seemed_to_need: d.seemedToNeed.trim(),
    outcome: d.outcome!,
    worker_name: d.workerName.trim(),
  };
}

/**
 * "Log what happened": about 30 seconds. It starts with what the worker wants to say (what they
 * tried, and whether it helped); what they saw is usually filled in from the cue they were reading. On success it thanks the worker and says the
 * family will see it. It never claims the note has been added to the profile.
 */
export function LogForm({
  name,
  source,
  cueOptions,
  contexts,
  initial,
  onClosed,
}: {
  name: string;
  source: WorkerSource;
  cueOptions: ReadonlyArray<{ id: string; label: string }>;
  contexts: readonly ContextTag[];
  initial: LogDraft;
  onClosed: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<{ cue?: string; outcome?: string; form?: string }>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const cueRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  // The family's cue list only when the note is about one of their cues; otherwise one text field.
  const withSelect = Boolean(initial.cueId) && cueOptions.length > 0;
  const formErrorRef = useRevealOn<HTMLDivElement>(errors.form);
  // The outcome comes first in the form, so its error is revealed first.
  const outcomeErrorRef = useRevealOn<HTMLDivElement>(errors.outcome);
  const placeId = useId();
  const outcomeId = useId();

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const set = <K extends keyof LogDraft>(key: K, value: LogDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateLog(draft);
    setErrors(found);
    if (found.outcome) return;
    if (found.cue) return reveal(cueRef.current);
    setSending(true);
    try {
      const result = await source.logNote(toWorkerNote(draft));
      if (result.status === 'ok') {
        setSent(true);
      } else if (result.status === 'busy') {
        setErrors({ form: copy.common.tryAgainSoon });
      } else if (result.status === 'closed') {
        onClosed();
      } else {
        setErrors({ form: copy.errors.generic });
      }
    } catch (err) {
      setErrors({ form: friendlyError(err) });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.logDone}>
        <Banner tone="success" ref={doneRef}>
          {l.sent(name)}
        </Banner>
        <div>
          <Button
            variant="outlined"
            onClick={() => {
              setDraft(emptyLog('', draft.contextTags[0] ?? null));
              setSent(false);
            }}
          >
            {l.another}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className={styles.logForm}>
      <p>{l.intro}</p>
      {errors.form ? (
        <Banner tone="error" ref={formErrorRef}>
          {errors.form}
        </Banner>
      ) : null}
      <FieldStack>
        <TextArea
          label={l.triedLabel}
          hint={l.triedHint}
          optional
          rows={2}
          maxLength={MAX}
          value={draft.tried}
          onChange={(e) => set('tried', e.target.value)}
        />

        <div className={styles.logContexts}>
          <p id={outcomeId} className={styles.logLegend}>
            {l.outcomeLegend}
          </p>
          <ChipGroup aria-labelledby={outcomeId}>
            {(['worked', 'partly', 'no'] as const).map((o) => (
              <ChoiceChip key={o} selected={draft.outcome === o} onClick={() => set('outcome', o)}>
                {l.outcomes[o]}
              </ChoiceChip>
            ))}
          </ChipGroup>
          {errors.outcome ? (
            <Banner tone="error" ref={outcomeErrorRef}>
              {errors.outcome}
            </Banner>
          ) : null}
        </div>

        {withSelect ? (
          <Select
            label={l.cueLabel}
            value={draft.cueId}
            onChange={(e) => set('cueId', e.target.value)}
            options={[{ value: '', label: l.cueOther }, ...cueOptions.map((c) => ({ value: c.id, label: c.label }))]}
          />
        ) : null}
        {!draft.cueId ? (
          <TextArea
            ref={cueRef}
            label={withSelect ? l.describeLabel : l.cueLabel}
            hint={l.describeHint}
            rows={2}
            maxLength={MAX}
            value={draft.cueText}
            onChange={(e) => set('cueText', e.target.value)}
            error={errors.cue}
          />
        ) : null}

        <TextField
          label={l.nameLabel}
          hint={l.nameHint}
          optional
          autoComplete="given-name"
          maxLength={40}
          value={draft.workerName}
          onChange={(e) => set('workerName', e.target.value)}
        />

        <details className={styles.more}>
          <summary>{l.more}</summary>
          <div className={styles.moreBody}>
            <TextArea
              label={l.neededLabel}
              hint={l.neededHint}
              optional
              rows={2}
              maxLength={MAX}
              value={draft.seemedToNeed}
              onChange={(e) => set('seemedToNeed', e.target.value)}
            />
            <div className={styles.logContexts}>
              <p id={placeId} className={styles.logLegend}>
                {l.placeLegend}
              </p>
              <ChipGroup aria-labelledby={placeId}>
                {contexts.map((tag) => {
                  const on = draft.contextTags.includes(tag);
                  return (
                    <ChoiceChip
                      key={tag}
                      selected={on}
                      onClick={() =>
                        set('contextTags', on ? draft.contextTags.filter((t) => t !== tag) : [...draft.contextTags, tag])
                      }
                    >
                      {copy.labels.context[tag]}
                    </ChoiceChip>
                  );
                })}
              </ChipGroup>
            </div>
            <TextField
              label={l.placeOtherLabel}
              optional
              maxLength={MAX}
              value={draft.contextText}
              onChange={(e) => set('contextText', e.target.value)}
            />
          </div>
        </details>
      </FieldStack>
      <div>
        <Button type="submit" disabled={sending}>
          {sending ? l.sending : l.submit(name)}
        </Button>
      </div>
    </form>
  );
}
