import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { Banner, Button, Card, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { friendlyError } from '../../lib/errors';
import { normaliseInviteCode } from '../../lib/invite';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.start;

/**
 * Creates the family's profile with their invite code. The code from the sign-up form travels in
 * the user's metadata, so this usually happens without asking. If it's missing or no longer valid
 * (for example, they signed in on a new device), we ask for it here.
 */
export function Start() {
  usePageTitle(c.title);
  const { session, status, refresh } = useAuth();
  const navigate = useNavigate();
  const savedCode = (session?.user.user_metadata as { invite_code?: string } | undefined)?.invite_code ?? '';
  const [code, setCode] = useState(savedCode);
  const [working, setWorking] = useState(Boolean(savedCode));
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const attempted = useRef(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function createProfile(value: string) {
    setWorking(true);
    setCodeError(undefined);
    setFormError(undefined);
    try {
      const { error } = await getSupabase().rpc('create_profile', { p_invite_code: normaliseInviteCode(value) });
      if (error) throw error;
      await refresh();
      navigate('/home', { replace: true });
    } catch (err) {
      const message = friendlyError(err);
      if (message === copy.errors.inviteCode) {
        setCodeError(message);
        codeRef.current?.focus();
      } else if (message === copy.errors.consentFirst) {
        navigate('/consent', { replace: true });
      } else {
        setFormError(message);
      }
      setWorking(false);
    }
  }

  // Runs once, with the code saved at sign-up. The ref stops StrictMode's double effect calling it twice.
  useEffect(() => {
    if (savedCode && !attempted.current && !status.profileId) {
      attempted.current = true;
      void createProfile(savedCode);
    }
  }, []);

  if (status.profileId) return <Navigate to="/home" replace />;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!normaliseInviteCode(code)) {
      setCodeError(copy.signUp.codeMissing);
      codeRef.current?.focus();
      return;
    }
    void createProfile(code);
  }

  if (working && !codeError && !formError) {
    return (
      <AppShell>
        <p role="status" className="t-muted">
          {c.working}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p>{c.intro}</p>
        </header>
        <Card as="form" noValidate onSubmit={onSubmit} className={styles.form}>
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          <TextField
            ref={codeRef}
            label={copy.signUp.codeLabel}
            hint={copy.signUp.codeHint}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={codeError}
          />
          <div className={styles.actions}>
            <Button type="submit" disabled={working}>
              {c.submit}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
