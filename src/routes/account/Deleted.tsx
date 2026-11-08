import { CalmWave } from '../../assets/illustrations';
import { AppShell } from '../../components/layout/AppShell';
import { ButtonLink } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from '../Welcome.module.css';

const c = copy.deleted;

export function Deleted() {
  usePageTitle(c.title);
  return (
    <AppShell>
      <div className={styles.hero}>
        <CalmWave className={styles.art} />
        <h1 className={styles.heading} role="status">
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
