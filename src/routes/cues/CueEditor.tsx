import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CardSwapSheet } from '../../components/cues/CardSwapSheet';
import {
  cueEditorDraftFrom,
  cueEditorDraftFromNote,
  emptyCueEditorDraft,
  emptyMeaning,
  hasErrors,
  parseAliases,
  toCueInput,
  validateCueEditor,
  type CueEditorDraft,
  type CueErrors,
  type MeaningDraft,
} from '../../components/cues/drafts';
import { cardCountAfter, withPin } from '../../components/cues/library';
import { CueTypeChips } from '../../components/cues/MeaningFields';
import { MeaningSection } from '../../components/cues/MeaningSection';
import { PlacePicker, WORKER_PLACES } from '../../components/cues/PlacePicker';
import { WorkerPreview } from '../../components/cues/WorkerPreview';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, Button, Checkbox, Select, Sheet, TextArea, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { CUE_CATEGORIES, LIMITS, type ContextTag, type Cue, type CueCategory, type ShiftNote } from '../../data/types';
import { MAX_PINNED, useFamilyData } from '../../family/FamilyDataProvider';
import { contextPhrase, pinnedCues } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { reveal, useRevealOn } from '../../lib/reveal';
import { useLeaveGuard } from '../../lib/useLeaveGuard';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cueEditor;
const f = copy.cueForm;
const n = copy.inbox;

/**
 * How the family arrived. Keys are worked out inside the editor from the draft it keeps, never
 * from a draft built on a later render (each build makes new keys).
 * - note: a worker's note; its meaning is the last one.
 * - added: "Add what it means at camp"; the new meaning is the last one.
 * - meaning: a meaning line in the library, by its saved id.
 */
type Arrival = { kind: 'note' } | { kind: 'added' } | { kind: 'meaning'; id: string };

/** The note's meaning (shown first, marked) and the meaning to open and focus, in a given draft. */
function arrivalKeys(draft: CueEditorDraft, arrival?: Arrival): { noteKey?: string; focusKey?: string } {
  const last = draft.meanings[draft.meanings.length - 1]?.key;
  if (arrival?.kind === 'note') return { noteKey: last };
  if (arrival?.kind === 'added') return { focusKey: last };
  if (arrival?.kind === 'meaning') return { focusKey: draft.meanings.find((m) => m.id === arrival.id)?.key };
  return {};
}

export function CueEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const { cues, notes } = useFamilyData();
  const isNew = id === undefined;
  const existing = isNew ? undefined : cues.find((cue) => cue.id === id);
  // "Edit then add" from the inbox: the note to confirm, if it's still waiting.
  const note = notes.find((x) => x.id === params.get('note') && x.status === 'pending');
  const add = params.get('add') as ContextTag | null;
  usePageTitle(isNew ? c.newTitle : c.editTitle);

  if (!isNew && !existing) {
    return (
      <FamilyShell>
        <div className={styles.page}>
          <Banner tone="error">{c.notFound}</Banner>
          <p>
            <Link to="/cues">{c.cancel}</Link>
          </p>
        </div>
      </FamilyShell>
    );
  }

  let initial: CueEditorDraft | undefined;
  let arrival: Arrival | undefined;
  if (note) {
    // Not focused: the page opens at the top, on the worker's words, with their meaning first below.
    initial = cueEditorDraftFromNote(note, cues);
    arrival = { kind: 'note' };
  } else if (existing) {
    initial = cueEditorDraftFrom(existing);
    const target = /^#meaning-(.+)$/.exec(hash)?.[1];
    if (add && WORKER_PLACES.includes(add)) {
      // "Add what it means at camp" from the library: a new meaning, already set to that place.
      const added: MeaningDraft = { ...emptyMeaning(), context_tags: [add] };
      initial = { ...initial, meanings: [...initial.meanings, added] };
      arrival = { kind: 'added' };
    } else if (target) {
      arrival = { kind: 'meaning', id: target };
    }
  }
  // Keyed so switching between cues (or notes) starts a fresh form.
  return (
    <CueEditor key={`${id ?? 'new'}-${note?.id ?? ''}-${add ?? ''}`} initial={initial} arrival={arrival} note={note} />
  );
}

/** "A phrase or word · Food and drink · Also written as cookie, cookies": what's folded away, as facts. */
function cueFacts(draft: CueEditorDraft): string {
  const aliases = parseAliases(draft.aliasesText);
  return [
    copy.labels.cueType[draft.cue_type],
    copy.labels.category[draft.category],
    aliases.length ? c.alsoWrittenAs(aliases.join(', ')) : '',
    draft.description.trim() ? c.hasDescription : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** What the worker wrote, quoted in their words above the form. Only the note's own fields. */
function NoteQuote({ note, saw }: { note: ShiftNote; saw: string }) {
  const where = contextPhrase(note.context_tags, note.context_text);
  const rows: [string, string][] = [
    [c.quoteSaw, saw],
    [n.where, where],
    [n.needed, note.seemed_to_need],
    [n.tried, note.tried],
    [n.helped, n.outcomes[note.outcome]],
  ];
  return (
    <figure className={styles.quote}>
      <figcaption className={styles.quoteBy}>{c.quoteHeading(note.worker_name.trim())}</figcaption>
      <blockquote className={styles.quoteBody}>
        <dl>
          {rows
            .filter(([, text]) => text.trim())
            .map(([label, text]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{text}</dd>
              </div>
            ))}
        </dl>
      </blockquote>
    </figure>
  );
}

function CueEditor({ initial, arrival, note }: { initial?: CueEditorDraft; arrival?: Arrival; note?: ShiftNote }) {
  const { cues, profile, saveCue, deleteCue, approveNote } = useFamilyData();
  const navigate = useNavigate();
  const name = profile.display_name.trim() || copy.cues.child;
  const noteId = note?.id;
  const othersOnCard = pinnedCues(cues).filter((cue) => cue.id !== initial?.id);
  // Frozen on the first render, with the keys that belong to it.
  const [start] = useState<CueEditorDraft>(() => initial ?? emptyCueEditorDraft(othersOnCard.length < MAX_PINNED));
  const [given] = useState(() => arrivalKeys(start, arrival));
  const [draft, setDraft] = useState<CueEditorDraft>(start);
  const [open, setOpen] = useState<Set<string>>(() => {
    const keys = new Set(start.meanings.filter((m) => !m.meaning.trim()).map((m) => m.key));
    if (!start.id) keys.add(start.meanings[0]!.key);
    if (given.focusKey) keys.add(given.focusKey);
    if (given.noteKey) keys.add(given.noteKey);
    return keys;
  });
  // New, empty meanings ask "Where does it mean this?" before anything else.
  const [freshKeys, setFreshKeys] = useState<ReadonlySet<string>>(
    () => new Set(start.meanings.filter((m) => !m.id && !m.meaning.trim() && !m.context_tags.length).map((m) => m.key)),
  );
  const [previewPlace, setPreviewPlace] = useState<ContextTag | null>(null);
  const [swapOut, setSwapOut] = useState<Cue | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [errors, setErrors] = useState<CueErrors>({ meanings: {} });
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const meaningRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const headingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const formErrorRef = useRevealOn<HTMLDivElement>(formError);

  const dirty = !saving && (swapOut !== null || JSON.stringify(draft) !== JSON.stringify(start));
  const guard = useLeaveGuard(dirty);

  // Arriving on one meaning (from the library, a place gap or a note): start there, its place heading focused.
  useLayoutEffect(() => {
    if (!given.focusKey) return;
    const heading = headingRefs.current.get(given.focusKey);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start' });
  }, [given.focusKey]);

  const set = <K extends keyof CueEditorDraft>(key: K, value: CueEditorDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setMeaning = (next: MeaningDraft) =>
    setDraft((d) => ({ ...d, meanings: d.meanings.map((m) => (m.key === next.key ? next : m)) }));
  const setOpenFor = (key: string, isOpen: boolean) =>
    setOpen((o) => {
      const next = new Set(o);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });

  // The note's meaning comes first, so it's the first thing to check. The saved order doesn't change.
  const shown = given.noteKey
    ? [...draft.meanings].sort((a, b) => Number(b.key === given.noteKey) - Number(a.key === given.noteKey))
    : draft.meanings;

  function addPlace() {
    const added = emptyMeaning();
    flushSync(() => {
      setDraft((d) => ({ ...d, meanings: [...d.meanings, added] }));
      setOpen((o) => new Set(o).add(added.key));
      setFreshKeys((k) => new Set(k).add(added.key));
    });
    const heading = headingRefs.current.get(added.key);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start' });
  }

  function removeMeaning(key: string) {
    const index = shown.findIndex((m) => m.key === key);
    const neighbour = shown[index - 1] ?? shown[index + 1];
    flushSync(() => set('meanings', draft.meanings.filter((m) => m.key !== key)));
    if (neighbour) headingRefs.current.get(neighbour.key)?.focus();
  }

  function onPinChange(checked: boolean) {
    if (!checked) {
      set('pinned', false);
      setSwapOut(null);
    } else if (othersOnCard.length >= MAX_PINNED) {
      setSwapOpen(true);
    } else {
      set('pinned', true);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const found = validateCueEditor(draft);
    setErrors(found);
    if (hasErrors(found)) {
      const missing = shown.filter((m) => found.meanings[m.key]).map((m) => m.key);
      flushSync(() => {
        setOpen((o) => new Set([...o, ...missing]));
        // A meaning still asking "where" shows its fields, so the missing words can be pointed to.
        setFreshKeys((k) => new Set([...k].filter((key) => !missing.includes(key))));
      });
      reveal(found.label ? labelRef.current : meaningRefs.current.get(missing[0]!));
      return;
    }
    setSaving(true);
    let tookOff = false;
    try {
      // A swap from the card tick: take the chosen cue off first, so the card never holds six.
      if (swapOut && draft.pinned) {
        const off = withPin(swapOut, false);
        await saveCue(off.cue, off.meanings);
        tookOff = true;
      }
      const { cue, meanings } = toCueInput(draft);
      if (noteId) {
        await approveNote(noteId, cue, meanings);
        navigate('/inbox', { state: { notice: copy.inbox.added } });
      } else {
        const saved = await saveCue(cue, meanings);
        // Back in the library, focus returns to the cue that was changed.
        navigate('/cues', { state: { notice: copy.cues.saved, focusCue: saved.id } });
      }
    } catch (err) {
      if (tookOff && swapOut) {
        // Put the card back as it was, so a failed save never leaves a gap.
        const back = withPin(swapOut, true);
        await saveCue(back.cue, back.meanings).catch(() => undefined);
      }
      setFormError(friendlyError(err));
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!draft.id) return;
    try {
      setSaving(true);
      await deleteCue(draft.id);
      navigate('/cues', { state: { notice: copy.cues.deleted } });
    } catch (err) {
      setSaving(false);
      setConfirmDelete(false);
      setFormError(friendlyError(err));
    }
  }

  const backTo = noteId ? '/inbox' : '/cues';
  const backText = noteId ? copy.inbox.backToInbox : c.cancel;
  const cardFull = othersOnCard.length >= MAX_PINNED;
  const isNew = !draft.id;

  // The rarely changed facts about the cue, and whether it's on the card.
  const cueExtras = (
    <>
      <details className={styles.more}>
        <summary className={styles.summary}>
          <span className={styles.summaryText}>
            <span className={styles.summaryTitle}>{c.moreAboutCue}</span>
            <span className={styles.summaryHint}>{cueFacts(draft)}</span>
          </span>
          <span className={styles.fold} aria-hidden="true">
            <span className={styles.whenClosed}>{c.show}</span>
            <span className={styles.whenOpen}>{c.hide}</span>
          </span>
        </summary>
        <div className={styles.moreBody}>
          <Select
            label={f.categoryLabel}
            value={draft.category}
            onChange={(e) => set('category', e.target.value as CueCategory)}
            options={CUE_CATEGORIES.map((k) => ({ value: k, label: copy.labels.category[k] }))}
          />
          <CueTypeChips value={draft.cue_type} onChange={(v) => set('cue_type', v)} />
          <TextArea
            label={c.descriptionLabel}
            hint={c.descriptionHint}
            optional
            rows={2}
            maxLength={500}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <TextField
            label={c.aliasesLabel}
            hint={c.aliasesHint}
            optional
            autoComplete="off"
            maxLength={800}
            value={draft.aliasesText}
            onChange={(e) => set('aliasesText', e.target.value)}
          />
        </div>
      </details>
      <div className={styles.pinField}>
        <Checkbox label={c.pinLabel(name)} checked={draft.pinned} onChange={(e) => onPinChange(e.target.checked)} />
        {swapOut && draft.pinned ? (
          <p className={styles.swapNote}>
            {c.swapPending(swapOut.label)}{' '}
            <button
              type="button"
              className={styles.inlineButton}
              onClick={() => {
                setSwapOut(null);
                set('pinned', false);
              }}
              aria-label={c.swapUndoLabel(swapOut.label)}
            >
              {c.swapUndo}
            </button>
          </p>
        ) : (
          <p className="t-small t-muted">
            {!draft.pinned && cardFull
              ? c.pinFull
              : c.pinHint(cardCountAfter(othersOnCard.length, draft.pinned, swapOut !== null))}
          </p>
        )}
      </div>
    </>
  );

  const meaningsSection = (
    <section aria-labelledby="meanings-heading" className={note ? styles.meaningsFirst : styles.meanings}>
      <div className={styles.meaningsHead}>
        <h2 id="meanings-heading" className={styles.kicker}>
          {c.meaningsHeading}
        </h2>
        <p className={styles.intro}>{c.meaningsIntro}</p>
      </div>
      {shown.map((m) => (
        <MeaningSection
          key={m.key}
          draft={m}
          open={open.has(m.key)}
          fresh={freshKeys.has(m.key)}
          onPlaced={() =>
            setFreshKeys((k) => {
              const next = new Set(k);
              next.delete(m.key);
              return next;
            })
          }
          hints={!m.id && m.key !== given.noteKey}
          marker={
            m.key === given.noteKey
              ? [c.fromNote(note?.worker_name.trim() ?? ''), m.meaning.trim() ? '' : copy.inbox.needsMeaning]
                  .filter(Boolean)
                  .join(' ')
              : undefined
          }
          onOpenChange={(isOpen) => {
            flushSync(() => setOpenFor(m.key, isOpen));
            headingRefs.current.get(m.key)?.focus({ preventScroll: !isOpen });
          }}
          onChange={setMeaning}
          onRemove={draft.meanings.length > 1 ? () => removeMeaning(m.key) : undefined}
          error={errors.meanings[m.key]}
          meaningRef={(el) => {
            if (el) meaningRefs.current.set(m.key, el);
            else meaningRefs.current.delete(m.key);
          }}
          headingRef={(el) => {
            if (el) headingRefs.current.set(m.key, el);
            else headingRefs.current.delete(m.key);
          }}
        />
      ))}
      {/* One question at a time: another place can be added once this one says where. */}
      {freshKeys.size ? null : (
        <div className={styles.addPlaceRow}>
          <button type="button" className={styles.addPlace} onClick={addPlace}>
            {c.addMeaning}
          </button>
        </div>
      )}
    </section>
  );

  return (
    <FamilyShell width="wide">
      <form noValidate onSubmit={onSubmit} className={styles.editor}>
        <div className={styles.editorMain}>
          <div className={styles.editorTop}>
            <Link to={backTo} className={styles.back}>
              {backText}
            </Link>
            <PageHeading className={`t-h2 ${styles.editorTitle}`}>
              {draft.id ? draft.label || c.editTitle : c.newTitle}
            </PageHeading>
          </div>
          {/* From the inbox: the worker's own words stand at the top, with their meaning first below. */}
          {/* "They saw": the worker's words, or the cue they picked from the profile. */}
          {note ? <NoteQuote note={note} saw={note.cue_text.trim() || start.label} /> : null}
          {formError ? (
            <Banner tone="error" ref={formErrorRef}>
              {formError}
            </Banner>
          ) : null}

          <div className={styles.page2}>
            {note ? meaningsSection : null}
            <section aria-label={c.cueSection} className={note ? styles.cueAfter : styles.cueSheet}>
              <TextField
                ref={labelRef}
                label={isNew && !note ? c.seeHearQuestion : f.labelLabel}
                hint={draft.id ? undefined : f.labelHints[draft.cue_type]}
                maxLength={LIMITS.cueLabel}
                value={draft.label}
                onChange={(e) => set('label', e.target.value)}
                error={errors.label}
                className={styles.labelInput}
              />
              {isNew && !note ? null : cueExtras}
            </section>
            {note ? null : meaningsSection}
            {/* A new cue is a short interview: what you see, where, what it means. One fold comes last. */}
            {isNew && !note ? <div className={styles.cueExtras}>{cueExtras}</div> : null}
          </div>

          <div className={styles.actions}>
            <Button type="submit" disabled={saving}>
              {saving ? c.saving : c.save}
            </Button>
            <Link to={backTo} className={styles.back}>
              {backText}
            </Link>
          </div>

          {draft.id && !noteId ? (
            <div className={styles.danger}>
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                {c.delete}
              </Button>
            </div>
          ) : null}
        </div>

        <aside className={styles.editorPreview} aria-labelledby="preview-heading">
          <div className={styles.previewHead}>
            <h2 id="preview-heading" className={styles.previewTitle}>
              {c.previewHeading}
            </h2>
            <p className={styles.previewHint}>{c.previewHint}</p>
          </div>
          <PlacePicker label={copy.cues.placeLabel} value={previewPlace} onChange={setPreviewPlace} />
          <div className={styles.previewSheet}>
            <WorkerPreview
              label={draft.label}
              meanings={draft.meanings}
              place={previewPlace}
              emptyText={c.previewEmpty}
            />
          </div>
        </aside>
      </form>

      <CardSwapSheet
        adding={swapOpen ? draft.label.trim() || c.thisCue : null}
        pinned={othersOnCard}
        onSwap={(remove) => {
          setSwapOpen(false);
          setSwapOut(remove);
          set('pinned', true);
        }}
        onClose={() => setSwapOpen(false)}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={c.deleteTitle(draft.label)}>
        <p>{c.deleteBody}</p>
        <div className={styles.actions}>
          <Button onClick={() => void onDelete()}>{c.deleteConfirm}</Button>
          <Button variant="outlined" onClick={() => setConfirmDelete(false)}>
            {copy.common.cancel}
          </Button>
        </div>
      </Sheet>

      <Sheet open={guard.pending !== null} onClose={guard.stay} title={c.leaveTitle}>
        <p>{c.leaveBody}</p>
        <div className={styles.actions}>
          <Button onClick={guard.stay}>{c.leaveStay}</Button>
          <Button variant="outlined" onClick={guard.leave}>
            {c.leaveGo}
          </Button>
        </div>
      </Sheet>
    </FamilyShell>
  );
}
