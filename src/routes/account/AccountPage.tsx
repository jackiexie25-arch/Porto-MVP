import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Banner, Button, Card, Sheet, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { buildExport, deleteAccount, downloadJson, exportFileName } from '../../data/account';
import { logEvent } from '../../data/events';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { friendlyError } from '../../lib/errors';
import { usePageTitle } from '../../lib/usePageTitle';
import { AboutEditor, WhoEditor } from '../family/CardEditors';
import styles from './Account.module.css';

const c = copy.account;

/** The word the family types to delete: the child's name, or DELETE before they've added one. */
export function confirmWord(displayName: string): string {
  return displayName.trim() || c.confirmWordNoName;
}

export function confirmMatches(typed: string, word: string): boolean {
  return typed.trim().toLowerCase() === word.trim().toLowerCase();
}

function DeleteSheet({ open, onClose, word }: { open: boolean; onClose: () => void; word: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirmMatches(typed, word)) {
      setError(c.confirmMismatch(word));
      inputRef.current?.focus();
      return;
    }
    setDeleting(true);
    setError(undefined);
    try {
      await deleteAccount(typed);
      // Leave the signed-in area first, so the sign-in guard doesn't redirect mid-way.
      navigate('/deleted', { replace: true });
      await signOut().catch(() => undefined);
    } catch (err) {
      setError(/confirm_mismatch/.test(String((err as { message?: string }).message)) ? c.confirmMismatch(word) : friendlyError(err));
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={c.deleteTitle}>
      <form noValidate onSubmit={onSubmit} className={styles.form}>
        <p>{c.deleteBody}</p>
        <TextField
          ref={inputRef}
          label={c.confirmLabel(word)}
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          error={error}
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={deleting}>
            {deleting ? c.deleting : c.deleteConfirm}
          </Button>
          <Button variant="outlined" onClick={onClose} disabled={deleting}>
            {c.keep}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

export function AccountPage() {
  usePageTitle(c.title);
  const { session } = useAuth();
  const { profile } = useFamilyData();
  const navigate = useNavigate();
  const [download, setDownload] = useState<{ state: 'idle' | 'working' | 'done' } | { state: 'error'; message: string }>({
    state: 'idle',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const name = profile.display_name.trim() || copy.setup.yourChild;

  async function onDownload() {
    setDownload({ state: 'working' });
    try {
      downloadJson(await buildExport(), exportFileName(profile.display_name));
      logEvent('profile_exported');
      setDownload({ state: 'done' });
    } catch (err) {
      setDownload({ state: 'error', message: friendlyError(err) });
    }
  }

  return (
    <FamilyShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          {session?.user.email ? <p className="t-muted">{c.signedInAs(session.user.email)}</p> : null}
          <div>
            <Button variant="outlined" onClick={() => navigate('/signout')}>
              {c.signOut}
            </Button>
          </div>
        </header>

        <Card as="section" aria-labelledby="account-about">
          <h2 id="account-about" className="t-h3">
            {c.aboutHeading(name)}
          </h2>
          <AboutEditor />
        </Card>

        <Card as="section" aria-labelledby="account-who">
          <h2 id="account-who" className="t-h3">
            {c.whoHeading}
          </h2>
          <WhoEditor />
        </Card>

        <Card as="section" aria-labelledby="account-download">
          <h2 id="account-download" className="t-h3">
            {c.downloadHeading}
          </h2>
          <p>{c.downloadBody}</p>
          <div className={styles.actions}>
            <Button variant="outlined" onClick={() => void onDownload()} disabled={download.state === 'working'}>
              {download.state === 'working' ? c.downloading : c.downloadJson}
            </Button>
            <Link to="/card/print">{c.printLink}</Link>
          </div>
          {download.state === 'done' ? <Banner tone="success">{c.downloaded}</Banner> : null}
          {download.state === 'error' ? <Banner tone="error">{download.message}</Banner> : null}
        </Card>

        <Card as="section" aria-labelledby="account-setup">
          <h2 id="account-setup" className="t-h3">
            {c.setupHeading}
          </h2>
          <p>{c.setupBody}</p>
          <p>
            <Link to="/setup/1">{c.setupLink}</Link>
          </p>
        </Card>

        <Card as="section" aria-labelledby="account-delete" className={styles.delete}>
          <h2 id="account-delete" className="t-h3">
            {c.deleteHeading}
          </h2>
          <p>{c.deleteBody}</p>
          <p className="t-muted">{c.deleteTip}</p>
          <div>
            <Button variant="outlined" onClick={() => setConfirmOpen(true)}>
              {c.deleteOpen}
            </Button>
          </div>
        </Card>
      </div>

      <DeleteSheet
        key={String(confirmOpen)}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        word={confirmWord(profile.display_name)}
      />
    </FamilyShell>
  );
}
