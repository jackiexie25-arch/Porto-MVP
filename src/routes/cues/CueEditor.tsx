import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  cueEditorDraftFrom,
  emptyCueEditorDraft,
  emptyMeaning,
  hasErrors,
  toCueInput,
  validateCueEditor,
  type CueEditorDraft,
  type CueErrors,
  type MeaningDraft,
} from '../../components/cues/drafts';
import { CueTypeChips, MeaningFields } from '../../components/cues/MeaningFields';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Banner, Button, Card, Checkbox, FieldStack, Select, Sheet, TextArea, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { CUE_CATEGORIES, LIMITS, type CueCategory } from '../../data/types';
import { MAX_PINNED, useFamilyData } from '../../family/FamilyDataProvider';
import { friendlyError } from '../../lib/errors';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cueEditor;
const f = copy.cueForm;

export function CueEditorPage() {
  const { id } = useParams();
  const { cues } = useFamilyData();
  const isNew = id === undefined;
  const existing = isNew ? undefined : cues.find((cue) => cue.id === id);
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
  // Keyed so switching between cues starts a fresh form.
  return <CueEditor key={id ?? 'new'} initial={existing ? cueEditorDraftFrom(existing) : undefined} />;
}

function CueEditor({ initial }: { initial?: CueEditorDraft }) {
  const { cues, saveCue, deleteCue } = useFamilyData();
  const navigate = useNavigate();
  const pinnedElsewhere = cues.filter((cue) => cue.pinned && cue.id !== initial?.id).length;
  const [draft, setDraft] = useState<CueEditorDraft>(() => initial ?? emptyCueEditorDraft(pinnedElsewhere < MAX_PINNED));
  const [errors, setErrors] = useState<CueErrors>({ meanings: {} });
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const meaningRefs = useRef(new Map<string, HTMLTextAreaElement>());

  const set = <K extends keyof CueEditorDraft>(key: K, value: CueEditorDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setMeaning = (next: MeaningDraft) =>
    setDraft((d) => ({ ...d, meanings: d.meanings.map((m) => (m.key === next.key ? next : m)) }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const found = validateCueEditor(draft);
    setErrors(found);
    if (hasErrors(found)) {
      if (found.label) labelRef.current?.focus();
      else meaningRefs.current.get(Object.keys(found.meanings)[0]!)?.focus();
      return;
    }
    setSaving(true);
    try {
      const { cue, meanings } = toCueInput(draft);
      await saveCue(cue, meanings);
      navigate('/cues', { state: { notice: copy.cues.saved } });
    } catch (err) {
      setFormError(friendlyError(err));
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!draft.id) return;
    try {
      await deleteCue(draft.id);
      navigate('/cues', { state: { notice: copy.cues.deleted } });
    } catch (err) {
      setConfirmDelete(false);
      setFormError(friendlyError(err));
    }
  }

  return (
    <FamilyShell>
      <form noValidate onSubmit={onSubmit} className={styles.form}>
        <h1 className="t-h2">{draft.id ? draft.label || c.editTitle : c.newTitle}</h1>
        {formError ? <Banner tone="error">{formError}</Banner> : null}

        <Card as="section" aria-label={c.cueHeading}>
          <h2 className="t-h3">{c.cueHeading}</h2>
          <FieldStack>
            <CueTypeChips value={draft.cue_type} onChange={(v) => set('cue_type', v)} />
            <TextField
              ref={labelRef}
              label={f.labelLabel}
              hint={f.labelHints[draft.cue_type]}
              maxLength={LIMITS.cueLabel}
              value={draft.label}
              onChange={(e) => set('label', e.target.value)}
              error={errors.label}
            />
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
            <div>
              <Checkbox label={c.pinLabel} checked={draft.pinned} onChange={(e) => set('pinned', e.target.checked)} />
              <p className="t-small t-muted">{c.pinHint(pinnedElsewhere + (draft.pinned ? 1 : 0))}</p>
            </div>
          </FieldStack>
        </Card>

        <section aria-label={c.meaningsHeading} className={styles.form}>
          <div>
            <h2 className="t-h3">{c.meaningsHeading}</h2>
            <p>{c.meaningsIntro}</p>
          </div>
          {draft.meanings.map((m, i) => (
            <Card as="section" key={m.key} className={styles.meaningCard} aria-label={c.meaningLegend(i + 1)}>
              <div className={styles.meaningHeader}>
                <h3>{c.meaningLegend(i + 1)}</h3>
                {draft.meanings.length > 1 ? (
                  <Button
                    variant="secondary"
                    onClick={() => set('meanings', draft.meanings.filter((x) => x.key !== m.key))}
                  >
                    {c.removeMeaning}
                  </Button>
                ) : null}
              </div>
              <MeaningFields
                draft={m}
                onChange={setMeaning}
                error={errors.meanings[m.key]}
                meaningRef={(el) => {
                  if (el) meaningRefs.current.set(m.key, el);
                  else meaningRefs.current.delete(m.key);
                }}
              />
            </Card>
          ))}
          <div>
            <Button variant="outlined" onClick={() => set('meanings', [...draft.meanings, emptyMeaning()])}>
              {c.addMeaning}
            </Button>
          </div>
        </section>

        <div className={styles.actions}>
          <Button type="submit" disabled={saving}>
            {saving ? c.saving : c.save}
          </Button>
          <Link to="/cues">{c.cancel}</Link>
        </div>

        {draft.id ? (
          <div>
            <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
              {c.delete}
            </Button>
          </div>
        ) : null}
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
    </FamilyShell>
  );
}
