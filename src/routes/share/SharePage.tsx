import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { QrCode } from '../../components/share/QrCode';
import { Banner, Button, ChipGroup, ChoiceChip, FieldStack, RadioGroup, Sheet, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { createShare, listShares, revokeShare, type CreatedShare } from '../../data/shares';
import { LIMITS } from '../../data/types';
import { useCardModel } from '../../family/useCardModel';
import { friendlyError } from '../../lib/errors';
import { reveal, useRevealOn } from '../../lib/reveal';
import {
  closesAt,
  closesWhen,
  durationChoices,
  durationHours,
  isOpen,
  shareStatus,
  shareUrl,
  type DurationKey,
  type ShareRow,
} from '../../lib/share';
import { useLeaveGuard } from '../../lib/useLeaveGuard';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Share.module.css';

const c = copy.share;
type Scope = ShareRow['scope'];

interface FormState {
  label: string;
  workerName: string;
  duration: DurationKey;
  scope: Scope;
}

const emptyForm: FormState = { label: '', workerName: '', duration: 'shift', scope: 'card_search_log' };

/**
 * The new link, shown once. Copying it is the one main action. Leaving before it's copied or sent
 * (Done, or a link in the menu) asks first, because the link can't be shown again.
 */
function LinkReady({ created, name, onDone }: { created: CreatedShare; name: string; onDone: () => void }) {
  const url = shareUrl(created.token);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [kept, setKept] = useState(false);
  const [asking, setAsking] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const headingRef = useRef<HTMLHeadingElement>(null);
  const guard = useLeaveGuard(!kept);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ tone: 'success', text: c.copied });
      setKept(true);
      return true;
    } catch {
      setNotice({ tone: 'error', text: c.copyFailed });
      return false;
    }
  }

  return (
    <section aria-labelledby="link-ready" className={styles.sheet}>
      <h2 id="link-ready" ref={headingRef} tabIndex={-1} className={`t-h3 ${styles.focusHeading}`}>
        {c.readyHeading}
      </h2>
      <p>{c.readyBody(closesAt(new Date(created.expires_at)))}</p>
      <TextField label={c.linkLabel} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
      <div className={styles.actions}>
        <Button onClick={() => void copyLink()}>{c.copy}</Button>
        {canShare ? (
          <Button
            variant="outlined"
            onClick={() =>
              void navigator
                .share({ title: copy.meta.appName, text: c.nativeShareText(name), url })
                .then(() => setKept(true))
                .catch(() => undefined)
            }
          >
            {c.nativeShare}
          </Button>
        ) : null}
      </div>
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <div className={styles.qr}>
        <h3 className={styles.label}>{c.qrHeading}</h3>
        <QrCode value={url} label={c.qrLabel} />
      </div>
      <p className={styles.quiet}>{c.once}</p>
      <div>
        <Button variant="secondary" onClick={() => (kept ? onDone() : setAsking(true))}>
          {c.done}
        </Button>
      </div>

      <Sheet open={asking || guard.pending !== null} onClose={() => {
          setAsking(false);
          guard.stay();
        }} title={c.uncopiedTitle}>
        <p>{c.uncopiedBody(closesAt(new Date(created.expires_at)))}</p>
        <div className={styles.sheetActions}>
          <div>
            <Button
              onClick={() =>
                void copyLink().then((ok) => {
                  if (!ok) return;
                  setAsking(false);
                  if (guard.pending !== null) guard.leave();
                  else onDone();
                })
              }
            >
              {c.uncopiedCopy}
            </Button>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setAsking(false);
                if (guard.pending !== null) guard.leave();
                else onDone();
              }}
            >
              {c.uncopiedLeave}
            </Button>
          </div>
        </div>
      </Sheet>
    </section>
  );
}

function ShareList({
  shares,
  onClose,
  onAgain,
}: {
  shares: ShareRow[];
  onClose: (share: ShareRow) => void;
  onAgain: (share: ShareRow) => void;
}) {
  if (!shares.length) return <p className={styles.quiet}>{c.linksEmpty}</p>;
  return (
    <ul className={styles.list}>
      {shares.map((share) => {
        const open = isOpen(share);
        const facts = [share.worker_name ? c.forWorker(share.worker_name) : '', c.scopesShort[share.scope]].filter(Boolean).join(' · ');
        return (
          <li key={share.id} className={styles.row}>
            <h3 className={styles.rowTitle}>{share.label}</h3>
            <p className={styles.quiet}>{facts}</p>
            <p className={open ? styles.status : styles.quiet}>{shareStatus(share)}</p>
            <div className={styles.rowActions}>
              {open ? (
                <button type="button" className={styles.textButton} onClick={() => onClose(share)} aria-label={c.closeLabel(share.label)}>
                  {c.close}
                </button>
              ) : null}
              <button type="button" className={styles.textButton} onClick={() => onAgain(share)} aria-label={c.againLabel(share.label)}>
                {c.again}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SharePage() {
  usePageTitle(c.title);
  const { model } = useCardModel();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [labelError, setLabelError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [listError, setListError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const labelRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRevealOn<HTMLDivElement>(formError);
  // The choices that make sense now, and when each would close, worked out once when the page opens.
  const choices = useMemo(() => {
    const now = new Date();
    return durationChoices(now).map((d) => ({ value: d, label: c.durations[d], hint: c.durationUntil(closesWhen(d, now)) }));
  }, []);

  const load = useCallback(async () => {
    try {
      setShares(await listShares());
      setListError(undefined);
    } catch (err) {
      setListError(friendlyError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setNotice(undefined);
    if (!form.label.trim()) {
      setLabelError(c.labelMissing);
      reveal(labelRef.current);
      return;
    }
    setLabelError(undefined);
    setCreating(true);
    try {
      const result = await createShare({
        label: form.label.trim(),
        workerName: form.workerName.trim(),
        hours: durationHours(form.duration),
        scope: form.scope,
      });
      setCreated(result);
      setForm(emptyForm);
      void load();
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setCreating(false);
    }
  }

  async function onClose(share: ShareRow) {
    setNotice(undefined);
    try {
      await revokeShare(share.id);
      setNotice(c.closed);
      await load();
    } catch (err) {
      setListError(friendlyError(err));
    }
  }

  function onAgain(share: ShareRow) {
    setCreated(null);
    setNotice(undefined);
    setForm({ ...emptyForm, label: share.label, workerName: share.worker_name, scope: share.scope });
    reveal(labelRef.current);
  }

  return (
    <FamilyShell hideShare>
      <div className={styles.page}>
        <header className={styles.header}>
          <PageHeading className="t-h2">{c.heading}</PageHeading>
          <p className={styles.intro}>{c.intro(model.name)}</p>
        </header>

        {created ? (
          <LinkReady created={created} name={model.name} onDone={() => setCreated(null)} />
        ) : (
          <form noValidate onSubmit={onSubmit} className={styles.sheet}>
            {formError ? (
              <Banner tone="error" ref={formErrorRef}>
                {formError}
              </Banner>
            ) : null}
            <FieldStack>
              <div className={styles.labelGroup}>
                <TextField
                  ref={labelRef}
                  label={c.labelLabel}
                  hint={c.labelHint}
                  maxLength={80}
                  autoComplete="off"
                  value={form.label}
                  onChange={(e) => set('label', e.target.value)}
                  error={labelError}
                />
                <ChipGroup aria-label={c.labelSuggestionsLabel}>
                  {c.labelSuggestions.map((suggestion) => (
                    <ChoiceChip
                      key={suggestion}
                      selected={form.label === suggestion}
                      onClick={() => {
                        set('label', suggestion);
                        setLabelError(undefined);
                      }}
                    >
                      {suggestion}
                    </ChoiceChip>
                  ))}
                </ChipGroup>
              </div>
              <TextField
                label={c.workerLabel}
                hint={c.workerHint}
                optional
                maxLength={LIMITS.name}
                autoComplete="off"
                value={form.workerName}
                onChange={(e) => set('workerName', e.target.value)}
              />
              <RadioGroup
                legend={c.durationLegend}
                hint={c.durationHint}
                name="duration"
                value={form.duration}
                options={choices}
                onChange={(v) => set('duration', v)}
              />
              <RadioGroup
                legend={c.scopeLegend}
                name="scope"
                value={form.scope}
                options={(['card', 'card_search', 'card_search_log'] as const).map((s) => ({ value: s, label: c.scopes[s] }))}
                onChange={(v) => set('scope', v)}
              />
            </FieldStack>
            <div>
              <Button type="submit" disabled={creating}>
                {creating ? c.creating : c.submit}
              </Button>
            </div>
          </form>
        )}

        <section aria-labelledby="your-links" className={styles.links}>
          <h2 id="your-links" className={styles.sectionHead}>
            <span>{c.linksHeading}</span>
            {shares ? <span className={styles.count}>{shares.length}</span> : null}
          </h2>
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {listError ? <Banner tone="error">{listError}</Banner> : null}
          {shares ? <ShareList shares={shares} onClose={(s) => void onClose(s)} onAgain={onAgain} /> : null}
        </section>
      </div>
    </FamilyShell>
  );
}
