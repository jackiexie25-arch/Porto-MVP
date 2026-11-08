import { Link } from 'react-router-dom';
import { SideBySide } from '../assets/illustrations';
import { useAuth } from '../auth/AuthProvider';
import { AppShell } from '../components/layout/AppShell';
import { ButtonLink } from '../components/ui';
import { copy } from '../copy/en-AU';
import { nextFamilyStep } from '../lib/family';
import { usePageTitle } from '../lib/usePageTitle';
import styles from './Welcome.module.css';

const c = copy.welcome;

export function Welcome() {
  usePageTitle(c.title);
  const { status } = useAuth();

  return (
    <AppShell>
      <div className={styles.hero}>
        <SideBySide className={styles.art} />
        <h1 className={styles.heading}>{c.heading}</h1>
        <p className="t-body-lg">{c.intro}</p>
        <p>{c.who}</p>
        <p>{c.control}</p>
        <p className="t-muted">{c.trial}</p>
        <div className={styles.actions}>
          {status.signedIn ? (
            <ButtonLink to={nextFamilyStep(status)}>{c.continue}</ButtonLink>
          ) : (
            <>
              <ButtonLink to="/signup">{c.start}</ButtonLink>
              <ButtonLink to="/signin" variant="secondary">
                {c.signIn}
              </ButtonLink>
            </>
          )}
        </div>
        <p>
          <Link to="/privacy">{c.privacyLink}</Link>
        </p>
      </div>
    </AppShell>
  );
}
