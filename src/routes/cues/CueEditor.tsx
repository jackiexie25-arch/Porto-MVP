import { useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { CueTypeChips } from '../../components/cues/MeaningFields';
import { MeaningSection } from '../../components/cues/MeaningSection';
import { PlacePicker } from '../../components/cues/PlacePicker';
import { WorkerPreview } from '../../components/cues/WorkerPreview';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { Banner, Button, Checkbox, Select, Sheet, TextArea, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { CUE_CATEGORIES, LIMITS, type ContextTag, type CueCategory } from '../../data/types';
import { MAX_PINNED, useFamilyData } from '../../family/FamilyDataProvider';
import { friendlyError } from '../../lib/errors';
import { reveal, useRevealOn } from '../../lib/reveal';
import { useLeaveGuard } from '../../lib/useLeaveGuard';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cueEditor;
const f = copy.cueForm;

export function CueEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { cues, notes } = useFamilyData();
  const isNew = id === undefined;
  const existing = isNew ? undefined : cues.find((cue) => cue.id === id);
  // "Edit then add" from the inbox: the note to confirm, if it's still waiting.
  const note = notes.find((n) => n.id === params.get('note') && n.status === 'pending');
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
  const initial = note ? cueEditorDraftFromNote(note, cues) : existing ? cueEditorDraftFrom(existing) : undefined;
  // Keyed so switching between cues (or notes) starts a fresh form.
  return <CueEditor key={`${id ?? 'new'}-${note?.id ?? ''}`} initial={initial} noteId={note?.id} />;
}

/**
 * Which meanings start open: a new cue's first, a worker's note's (the last one), and any with
 * nothing written yet. A saved cue opens closed, each meaning reading as a worker sees it.
 */
function initiallyOpen(draft: CueEditorDraft, fromNote: boolean): Set<string> {
  const open = new Set(draft.meanings.filter((m) => !m.meaning.trim()).map((m) => m.key));
  if (!draft.id) open.add(draft.meanings[0]!.key);
  if (fromNote) open.add(draft.meanings[draft.meanings.length - 1]!.key);
  return open;
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

function CueEditor({ initial, noteId }: { initial?: CueEditorDraft; noteId?: string }) {
  const { cues, profile, saveCue, deleteCue, approveNote } = useFamilyData();
  const navigate = useNavigate();
  const name = profile.display_name.trim() || copy.cues.child;
  const pinnedElsewhere = cues.filter((cue) => cue.pinned && cue.id !== initial?.id).length;
  const [start] = useState<CueEditorDraft>(() => initial ?? emptyCueEditorDraft(pinnedElsewhere < MAX_PINNED));
  const [draft, setDraft] = useState<CueEditorDraft>(start);
  const [open, setOpen] = useState<Set<string>>(() => initiallyOpen(start, Boolean(noteId)));
  const [previewPlace, setPreviewPlace] = useState<ContextTag | null>(null);
  const [errors, setErrors] = useState<CueErrors>({ meanings: {} });
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const meaningRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const headingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const formErrorRef = useRevealOn<HTMLDivElement>(formError);

  const dirty = !saving && JSON.stringify(draft) !== JSON.stringify(start);
  const guard = useLeaveGuard(dirty);

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

  function addPlace() {
    const added = emptyMeaning();
    flushSync(() => {
      setDraft((d) => ({ ...d, meanings: [...d.meanings, added] }));
      setOpen((o) => new Set(o).add(added.key));
    });
    const heading = headingRefs.current.get(added.key);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: 'start' });
  }

  function removeMeaning(key: string) {
    const index = draft.meanings.findIndex((m) => m.key === key);
    const neighbour = draft.meanings[index - 1] ?? draft.meanings[index + 1];
    flushSync(() => set('meanings', draft.meanings.filter((m) => m.key !== key)));
    if (neighbour) headingRefs.current.get(neighbour.key)?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const found = validateCueEditor(draft);
    setErrors(found);
    if (hasErrors(found)) {
      const missing = Object.keys(found.meanings);
      flushSync(() => setOpen((o) => new Set([...o, ...missing])));
      reveal(found.label ? labelRef.current : meaningRefs.current.get(missing[0]!));
      return;
    }
    setSaving(true);
    try {
      const { cue, meanings } = toCueInput(draft);
      if (noteId) {
        await approveNote(noteId, cue, meanings);
        navigate('/inbox', { state: { notice: copy.inbox.added } });
      } else {
        await saveCue(cue, meanings);
        navigate('/cues', { state: { notice: copy.cues.saved } });
      }
    } catch (err) {
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
          {noteId ? (
            <Banner tone="info">
              {copy.inbox.fromNote}
              {draft.meanings.some((m) => !m.meaning.trim()) ? ` ${copy.inbox.needsMeaning}` : ''}
            </Banner>
          ) : null}
          {formError ? (
            <Banner tone="error" ref={formErrorRef}>
              {formError}
            </Banner>
          ) : null}

          <section aria-label={c.cueSection} className={styles.cueSheet}>
            <TextField
              ref={labelRef}
              label={f.labelLabel}
              hint={f.labelHints[draft.cue_type]}
              maxLength={LIMITS.cueLabel}
              value={draft.label}
              onChange={(e) => set('label', e.target.value)}
              error={errors.label}
            />
            <details className={styles.more}>
              <summary className={styles.summary}>
                <span className={styles.summaryText}>
                  <span className={styles.summaryTitle}>{c.moreDetail}</span>
                  <span className={styles.summaryHint}>{cueFacts(draft)}</span>
                </span>
                <span className={styles.fold} aria-hidden="true">
                  <span className={styles.whenClosed}>{c.show}</span>
                  <span className={styles.whenOpen}>{c.hide}</span>
                </span>
              </summary>
              <div className={styles.moreBody}>
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
                <Select
                  label={f.categoryLabel}
                  value={draft.category}
                  onChange={(e) => set('category', e.target.value as CueCategory)}
                  options={CUE_CATEGORIES.map((k) => ({ value: k, label: copy.labels.category[k] }))}
                />
              </div>
            </details>
            <div className={styles.pinField}>
              <Checkbox label={c.pinLabel(name)} checked={draft.pinned} onChange={(e) => set('pinned', e.target.checked)} />
              <p className="t-small t-muted">{c.pinHint(pinnedElsewhere + (draft.pinned ? 1 : 0))}</p>
            </div>
          </section>

          <section aria-labelledby="meanings-heading" className={styles.meanings}>
            <div className={styles.meaningsHead}>
              <h2 id="meanings-heading" className="t-h3">
                {c.meaningsHeading}
              </h2>
              <p className={styles.intro}>{c.meaningsIntro}</p>
            </div>
            <div className={styles.meaningSheet}>
              {draft.meanings.map((m) => (
                <MeaningSection
                  key={m.key}
                  draft={m}
                  open={open.has(m.key)}
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
            </div>
            <Button variant="outlined" fullWidth onClick={addPlace}>
              {c.addMeaning}
            </Button>
          </section>

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
              name={name}
              emptyText={c.previewEmpty}
            />
          </div>
        </aside>
      </form>

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
