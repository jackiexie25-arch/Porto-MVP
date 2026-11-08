import { SideBySide } from '../assets/illustrations';
import { AppShell } from '../components/layout/AppShell';
import { ButtonLink } from '../components/ui';
import { copy } from '../copy/en-AU';
import { usePageTitle } from '../lib/usePageTitle';
import styles from './Welcome.module.css';

const c = copy.welcome;

/** Phase 0 welcome. Sign-up arrives in Phase 1. */
export function Welcome() {
  usePageTitle(c.title);
  return (
    <AppShell>
      <div className={styles.hero}>
        <SideBySide className={styles.art} />
        <h1 className={styles.heading}>{c.heading}</h1>
        <p className="t-body-lg">{c.intro}</p>
        <p>{c.who}</p>
        <p>{c.control}</p>
        <ButtonLink to="/styleguide" variant="outlined">
          {c.styleguideLink}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
