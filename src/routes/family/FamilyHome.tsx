import { useNavigate } from 'react-router-dom';
import { SideBySide } from '../../assets/illustrations';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from '../auth/Auth.module.css';

const c = copy.home;

/** Temporary signed-in home for Phase 1. Phase 2 replaces it with guided setup. */
export function FamilyHome() {
  usePageTitle(c.title);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className={styles.page}>
        <SideBySide className={styles.art} />
        <h1 className="t-h2">{c.heading}</h1>
        <p className="t-body-lg">{c.body}</p>
        <p className="t-muted">{c.building}</p>
        <div className={styles.actions}>
          <Button
            variant="outlined"
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
          >
            {c.signOut}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
