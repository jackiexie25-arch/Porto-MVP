import { useEffect, useRef } from 'react';
import { CalmWave } from '../../assets/illustrations';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from '../Welcome.module.css';

const c = copy.deleted;

export function Deleted() {
  usePageTitle(c.title);
  const { signOut } = useAuth();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The account no longer exists; clear what's left of the sign-in on this device.
  useEffect(() => {
    void signOut().catch(() => undefined);
  }, [signOut]);

  // Move focus to the heading so screen readers announce that the deletion is done.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <AppShell>
      <div className={styles.hero}>
        <CalmWave className={styles.art} />
        <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
          {c.heading}
        </h1>
        <p className="t-body-lg">{c.body}</p>
        <p>{c.thanks}</p>
        <ButtonLink to="/" variant="outlined">
          {c.home}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
