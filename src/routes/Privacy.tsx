import { AppShell } from '../components/layout/AppShell';
import { PrivacyDetails } from '../components/PrivacyDetails';
import { copy } from '../copy/en-AU';
import { usePageTitle } from '../lib/usePageTitle';
import styles from './auth/Auth.module.css';
import { PageHeading } from '../components/layout/PageHeading';

export function Privacy() {
  usePageTitle(copy.privacy.title);
  return (
    <AppShell>
      <div className={styles.page}>
        <PageHeading className="t-h2">{copy.privacy.heading}</PageHeading>
        <PrivacyDetails />
      </div>
    </AppShell>
  );
}
