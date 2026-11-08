import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CalmWave } from '../../assets/illustrations';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { nextFamilyStep } from '../../lib/family';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.authCallback;

/** True when Supabase sent the family back with an error (expired or already-used link). */
export function linkFailed(hash: string, search: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const query = new URLSearchParams(search);
  return params.has('error') || params.has('error_code') || query.has('error') || query.has('error_code');
}

/** Where magic links land. supabase-js reads the session from the URL and clears it. */
export function AuthCallback() {
  usePageTitle(c.title);
  const { loading, status } = useAuth();
  const [failed] = useState(() => linkFailed(window.location.hash, window.location.search));

  if (!failed && !loading && status.signedIn) {
    return <Navigate to={nextFamilyStep(status)} replace />;
  }

  if (failed || !loading) {
    return (
      <AppShell>
        <div className={styles.page}>
          <CalmWave className={styles.art} />
          <h1 className="t-h2">{c.expiredHeading}</h1>
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
