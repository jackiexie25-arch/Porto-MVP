import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FamilyShell } from '../../components/family/FamilyShell';
import { QrCode } from '../../components/share/QrCode';
import { Banner, Button, Card, FieldStack, RadioGroup, Tag, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { createShare, listShares, revokeShare, type CreatedShare } from '../../data/shares';
import { LIMITS } from '../../data/types';
import { useCardModel } from '../../family/useCardModel';
import { friendlyError } from '../../lib/errors';
import { DURATIONS, durationHours, formatUntil, isOpen, shareStatus, shareUrl, type DurationKey, type ShareRow } from '../../lib/share';
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

function LinkReady({ created, name, onDone }: { created: CreatedShare; name: string; onDone: () => void }) {
  const url = shareUrl(created.token);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string }>();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ tone: 'success', text: c.copied });
    } catch {
      setNotice({ tone: 'error', text: c.copyFailed });
    }
  }

  return (
    <Card as="section" aria-labelledby="link-ready" className={styles.ready}>
      <h2 id="link-ready" ref={headingRef} tabIndex={-1} className={`t-h3 ${styles.focusHeading}`}>
        {c.readyHeading}
      </h2>
      <p>{c.readyBody(formatUntil(created.expires_at))}</p>
      <QrCode value={url} label={c.qrLabel} />
      <TextField label={c.linkLabel} value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
      <div className={styles.actions}>
        <Button variant="outlined" onClick={() => void copyLink()}>
          {c.copy}
        </Button>
        {canShare ? (
          <Button
            variant="outlined"
            onClick={() => void navigator.share({ title: copy.meta.appName, text: c.nativeShareText(name), url }).catch(() => undefined)}
          >
            {c.nativeShare}
          </Button>
        ) : null}
      </div>
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <p className="t-small t-muted">{c.once}</p>
      <div>
        <Button variant="secondary" onClick={onDone}>
          {c.done}
        </Button>
      </div>
    </Card>
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
  if (!shares.length) return <p className="t-muted">{c.linksEmpty}</p>;
  return (
    <ul className={styles.list}>
      {shares.map((share) => {
        const open = isOpen(share);
        return (
          <Card as="li" key={share.id}>
            <h3 className="t-body-lg">
              <strong>{share.label}</strong>
            </h3>
            <div className={styles.tags}>
              {share.worker_name ? <Tag>{c.forWorker(share.worker_name)}</Tag> : null}
              <Tag>{c.scopes[share.scope]}</Tag>
            </div>
            <p className={open ? undefined : 't-muted'}>{shareStatus(share)}</p>
            <div className={styles.actions}>
              {open ? (
                <Button variant="outlined" onClick={() => onClose(share)} aria-label={c.closeLabel(share.label)}>
                  {c.close}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => onAgain(share)} aria-label={c.againLabel(share.label)}>
                {c.again}
              </Button>
            </div>
          </Card>
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
      labelRef.current?.focus();
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
    window.scrollTo({ top: 0 });
    labelRef.current?.focus();
  }

  return (
    <FamilyShell hideShare>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p>{c.intro}</p>
        </header>

        {created ? (
          <LinkReady created={created} name={model.name} onDone={() => setCreated(null)} />
        ) : (
          <Card as="form" noValidate onSubmit={onSubmit} className={styles.form}>
            {formError ? <Banner tone="error">{formError}</Banner> : null}
            <FieldStack>
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
                name="duration"
                value={form.duration}
                options={DURATIONS.map((d) => ({ value: d, label: c.durations[d] }))}
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
          </Card>
        )}

        <section aria-labelledby="your-links" className={styles.links}>
          <h2 id="your-links" className="t-h3">
            {c.linksHeading}
          </h2>
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {listError ? <Banner tone="error">{listError}</Banner> : null}
          {shares ? <ShareList shares={shares} onClose={(s) => void onClose(s)} onAgain={onAgain} /> : null}
        </section>
      </div>
    </FamilyShell>
  );
}
