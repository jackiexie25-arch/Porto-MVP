import { useEffect, useRef, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { Navigate } from 'react-router-dom';
import { CalmWave } from '../../assets/illustrations';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { nextFamilyStep } from '../../lib/family';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';
import { PageHeading } from '../../components/layout/PageHeading';

const c = copy.authCallback;

/** True when Supabase sent the family back with an error (expired or already-used link). */
export function linkFailed(hash: string, search: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search);
  return params.has('error') || params.has('error_code') || query.has('error') || query.has('error_code');
}

const LINK_TYPES: readonly EmailOtpType[] = ['email', 'magiclink', 'signup'];

/**
 * The one-time token from an email link that points at our own site
 * (`/auth/callback?token_hash=…&type=email`), or null for the older Supabase-hosted links.
 * Links on our own domain land in fewer spam folders, and mail scanners that open links
 * without running scripts can't use them up.
 */
export function linkToken(search: string): { token_hash: string; type: EmailOtpType } | null {
  const query = new URLSearchParams(search);
  const token_hash = query.get('token_hash');
  if (!token_hash) return null;
  const type = query.get('type') as EmailOtpType | null;
  return { token_hash, type: type && LINK_TYPES.includes(type) ? type : 'email' };
}

/**
 * Where magic links land. Older links come back with the session in the URL, which supabase-js
 * reads and clears. Newer links carry a token hash, which we exchange for a session here.
 */
export function AuthCallback() {
  usePageTitle(c.title);
  const { loading, status } = useAuth();
  const [failed, setFailed] = useState(() => linkFailed(window.location.hash, window.location.search));
  const [token] = useState(() => linkToken(window.location.search));
  const [verifying, setVerifying] = useState(() => token !== null && !failed);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    // Never leave the token in the address bar or history.
    window.history.replaceState(null, '', window.location.pathname);
    void getSupabase()
      .auth.verifyOtp(token)
      // On success the auth listener signs the family in and the redirect below takes over.
      .then(({ error }) => {
        if (error) {
          setFailed(true);
          setVerifying(false);
        }
      })
      .catch(() => {
        setFailed(true);
        setVerifying(false);
      });
  }, [token]);

  if (!failed && !verifying && !loading && status.signedIn) {
    return <Navigate to={nextFamilyStep(status)} replace />;
  }

  if (failed || (!verifying && !loading)) {
    return (
      <AppShell>
        <div className={styles.page}>
          <CalmWave className={styles.art} />
          <PageHeading className="t-h2">{c.expiredHeading}</PageHeading>
          <p>{c.expiredBody}</p>
          <div className={styles.actions}>
            <ButtonLink to="/signin">{c.newLink}</ButtonLink>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p role="status" className="t-muted">
        {c.signingIn}
      </p>
    </AppShell>
  );
}
