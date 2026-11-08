import { Link, useLocation } from 'react-router-dom';
import { WorkerPhone } from '../../assets/illustrations';
import { AppShell } from '../../components/layout/AppShell';
import { copy } from '../../copy/en-AU';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.checkEmail;

export function CheckEmail() {
  usePageTitle(c.title);
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return (
    <AppShell>
      <div className={styles.page}>
        <WorkerPhone className={styles.art} />
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p className="t-body-lg" role="status">
            {email ? c.sentTo(email) : c.sentGeneric}
          </p>
        </header>
        <p>{c.howTo}</p>
        <p>{c.expiry}</p>
        <p className="t-muted">{c.junk}</p>
        <p>
          <Link to="/signin">{c.differentEmail}</Link>
        </p>
      </div>
    </AppShell>
  );
}
