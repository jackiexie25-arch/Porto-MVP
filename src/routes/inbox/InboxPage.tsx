import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canAddInOneTap, cueEditorDraftFromNote, toCueInput } from '../../components/cues/drafts';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Banner, Button, Card, Tag } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { Cue, ShiftNote } from '../../data/types';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { contextPhrase } from '../../lib/card';
import { friendlyError } from '../../lib/errors';
import { timeAgo } from '../../lib/share';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Inbox.module.css';

const c = copy.inbox;

export function noteHeadline(note: ShiftNote, cues: readonly Cue[]): string {
  const cue = note.cue_id ? cues.find((x) => x.id === note.cue_id) : undefined;
  return cue?.label ?? (note.cue_text || c.aWorker);
}

function NoteDetails({ note, cues }: { note: ShiftNote; cues: readonly Cue[] }) {
  const where = contextPhrase(note.context_tags, note.context_text);
  return (
    <>
      <h3 className="t-body-lg">
        <strong>{noteHeadline(note, cues)}</strong>
      </h3>
      <dl className={styles.details}>
        {note.cue_id && note.cue_text ? (
          <div>
            <dt>{c.happened}</dt>
            <dd>{note.cue_text}</dd>
          </div>
        ) : null}
        {where ? (
          <div>
            <dt>{c.where}</dt>
            <dd>{where}</dd>
          </div>
        ) : null}
        {note.seemed_to_need ? (
          <div>
            <dt>{c.needed}</dt>
            <dd>{note.seemed_to_need}</dd>
          </div>
        ) : null}
        {note.tried ? (
          <div>
            <dt>{c.tried}</dt>
            <dd>{note.tried}</dd>
          </div>
        ) : null}
        <div>
          <dt>{c.helped}</dt>
          <dd>
            <Tag>{c.outcomes[note.outcome]}</Tag>
          </dd>
        </div>
      </dl>
      <p className="t-small t-muted">
        {c.from(note.worker_name || c.aWorker, timeAgo(note.created_at), note.shares?.label ?? '')}
      </p>
    </>
  );
}

/** Notes from workers. Nothing reaches the profile until the family adds it. No nagging, no push. */
export function InboxPage() {
  usePageTitle(c.title);
  const { notes, cues, approveNote, dismissNote } = useFamilyData();
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | undefined>(() => {
    const text = (location.state as { notice?: string } | null)?.notice;
    return text ? { tone: 'success', text } : undefined;
  });
  const [busy, setBusy] = useState<string>();

  const pending = notes.filter((n) => n.status === 'pending');
  const added = notes.filter((n) => n.status === 'approved');
  const setAside = notes.filter((n) => n.status === 'dismissed');

  function editPath(note: ShiftNote): string {
    const existing = note.cue_id && cues.some((x) => x.id === note.cue_id);
    return existing ? `/cues/${note.cue_id}?note=${note.id}` : `/cues/new?note=${note.id}`;
  }

  async function add(note: ShiftNote) {
    if (!canAddInOneTap(note, cues)) {
      navigate(editPath(note));
      return;
    }
    setBusy(note.id);
    setNotice(undefined);
    try {
      const { cue, meanings } = toCueInput(cueEditorDraftFromNote(note, cues));
      await approveNote(note.id, cue, meanings);
      setNotice({ tone: 'success', text: c.added });
    } catch (err) {
      setNotice({ tone: 'error', text: friendlyError(err) });
    } finally {
      setBusy(undefined);
    }
  }

  async function dismiss(note: ShiftNote) {
    setBusy(note.id);
    setNotice(undefined);
    try {
      await dismissNote(note.id);
      setNotice({ tone: 'success', text: c.dismissed });
    } catch (err) {
      setNotice({ tone: 'error', text: friendlyError(err) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <FamilyShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p>{c.intro}</p>
        </header>

        {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}

        <section aria-labelledby="inbox-new" className={styles.section}>
          <h2 id="inbox-new" className="t-h3">
            {c.pendingHeading(pending.length)}
          </h2>
          {pending.length ? (
            <ul className={styles.list}>
              {pending.map((note) => {
                const what = noteHeadline(note, cues);
                return (
                  <Card as="li" key={note.id}>
                    <NoteDetails note={note} cues={cues} />
                    <div className={styles.actions}>
                      <Button
                        variant="outlined"
                        disabled={busy === note.id}
                        onClick={() => void add(note)}
                        aria-label={c.addLabel(what)}
                      >
                        {c.add}
                      </Button>
                      <Button variant="secondary" onClick={() => navigate(editPath(note))} aria-label={c.editLabel(what)}>
                        {c.edit}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy === note.id}
                        onClick={() => void dismiss(note)}
                        aria-label={c.dismissLabel(what)}
                      >
                        {c.dismiss}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </ul>
          ) : (
            <p className="t-muted">{c.empty}</p>
          )}
        </section>

        {added.length ? (
          <details className={styles.folded}>
            <summary className="t-h3">{c.addedHeading(added.length)}</summary>
            <ul className={styles.list}>
              {added.map((note) => (
                <Card as="li" key={note.id}>
                  <NoteDetails note={note} cues={cues} />
                </Card>
              ))}
            </ul>
          </details>
        ) : null}

        {setAside.length ? (
          <details className={styles.folded}>
            <summary className="t-h3">{c.dismissedHeading(setAside.length)}</summary>
            <ul className={styles.list}>
              {setAside.map((note) => (
                <Card as="li" key={note.id}>
                  <NoteDetails note={note} cues={cues} />
                </Card>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </FamilyShell>
  );
}
