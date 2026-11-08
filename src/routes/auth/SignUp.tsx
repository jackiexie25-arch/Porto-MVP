import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { Banner, Button, Card, FieldStack, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { friendlyError } from '../../lib/errors';
import { nextFamilyStep } from '../../lib/family';
import { looksLikeEmail, normaliseInviteCode } from '../../lib/invite';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.signUp;

interface Errors {
  email?: string;
  code?: string;
  form?: string;
}

export function validateSignUp(email: string, code: string): Errors {
  const errors: Errors = {};
  if (!email.trim()) errors.email = c.emailMissing;
  else if (!looksLikeEmail(email)) errors.email = c.emailInvalid;
  if (!normaliseInviteCode(code)) errors.code = c.codeMissing;
  return errors;
}

export function SignUp() {
  usePageTitle(c.title);
  const { loading, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  if (!loading && status.signedIn) return <Navigate to={nextFamilyStep(status)} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateSignUp(email, code);
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.code) return codeRef.current?.focus();

    setSending(true);
    try {
      const supabase = getSupabase();
      const inviteCode = normaliseInviteCode(code);
      const check = await supabase.rpc('check_invite_code', { p_code: inviteCode });
      if (check.error) throw check.error;
      if (check.data !== true) {
        setErrors({ code: copy.errors.inviteCode });
        codeRef.current?.focus();
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true,
          data: { invite_code: inviteCode },
        },
      });
      if (error) throw error;
      navigate('/check-email', { state: { email: email.trim() } });
    } catch (error) {
      setErrors({ form: friendlyError(error) });
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
          {errors.form ? <Banner tone="error">{errors.form}</Banner> : null}
          <FieldStack>
            <TextField
              ref={emailRef}
              label={c.emailLabel}
              hint={c.emailHint}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <TextField
              ref={codeRef}
              label={c.codeLabel}
              hint={c.codeHint}
              name="invite-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={errors.code}
            />
          </FieldStack>
          <div className={styles.actions}>
            <Button type="submit" disabled={sending}>
              {sending ? c.sending : c.submit}
            </Button>
          </div>
        </Card>
        <p>
          <Link to="/signin">{c.haveAccount}</Link>
        </p>
      </div>
    </AppShell>
  );
}
