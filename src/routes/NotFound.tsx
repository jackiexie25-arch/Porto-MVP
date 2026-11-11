import { CalmWave } from '../assets/illustrations';
import { AppShell } from '../components/layout/AppShell';
import { ButtonLink } from '../components/ui';
import { copy } from '../copy/en-AU';
import { usePageTitle } from '../lib/usePageTitle';
import styles from './Welcome.module.css';
import { PageHeading } from '../components/layout/PageHeading';

const c = copy.notFound;

export function NotFound() {
  usePageTitle(c.title);
  return (
    <AppShell>
      <div className={styles.hero}>
        <CalmWave className={styles.art} />
        <PageHeading className={styles.heading}>{c.heading}</PageHeading>
        <p>{c.body}</p>
        <ButtonLink to="/" variant="outlined">
          {c.homeLink}
        </ButtonLink>
      </div>
    </AppShell>
  );
}
