import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { Banner, Button, Card, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { friendlyError } from '../../lib/errors';
import { nextFamilyStep } from '../../lib/family';
import { looksLikeEmail } from '../../lib/invite';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.signIn;

/** Supabase's answer when the email has no account. We show "check your email" anyway. */
function isUnknownAccount(error: { message?: string; code?: string }): boolean {
  return error.code === 'otp_disabled' || /signups not allowed/i.test(error.message ?? '');
}

export function SignIn() {
  usePageTitle(c.title);
  const { loading, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sending, setSending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  if (!loading && status.signedIn) return <Navigate to={nextFamilyStep(status)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const problem = !email.trim()
      ? copy.signUp.emailMissing
      : looksLikeEmail(email)
        ? undefined
        : copy.signUp.emailInvalid;
    setError(problem);
    if (problem) return emailRef.current?.focus();

    setSending(true);
    try {
      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false },
      });
      // Never reveal whether an account exists for this email.
      if (otpError && !isUnknownAccount(otpError)) throw otpError;
      navigate('/check-email', { state: { email: email.trim() } });
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSending(false);
    }
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
            ref={emailRef}
            label={copy.signUp.emailLabel}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <div className={styles.actions}>
            <Button type="submit" disabled={sending}>
              {sending ? c.sending : c.submit}
            </Button>
          </div>
        </Card>
        <p>
          <Link to="/signup">{c.noAccount}</Link>
        </p>
      </div>
    </AppShell>
  );
}
