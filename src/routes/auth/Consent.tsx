import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AppShell } from '../../components/layout/AppShell';
import { PrivacyDetails } from '../../components/PrivacyDetails';
import { Banner, Button, Card, Checkbox } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { CONSENT_VERSION } from '../../lib/consent';
import { friendlyError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Auth.module.css';

const c = copy.consent;

/** Blocks the rest of the app until the family agrees to the current consent version. */
export function Consent() {
  usePageTitle(c.title);
  const { session, status, refresh } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (status.consented) return <Navigate to="/start" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) {
      setError(c.agreeMissing);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const { error: insertError } = await getSupabase()
        .from('consents')
        .insert({ user_id: session?.user.id, version: CONSENT_VERSION });
      // 23505: already recorded (for example, agreed in another tab). That's fine.
      if (insertError && insertError.code !== '23505') throw insertError;
      await refresh();
      navigate('/start', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p className="t-body-lg">{c.intro}</p>
        </header>
        {/* A family with a profile has agreed before, so this is a new version: say what changed. */}
        {status.profileId ? (
          <Banner tone="info">
            <strong>{c.updatedHeading}.</strong> {c.updatedBody}
          </Banner>
        ) : null}
        <PrivacyDetails />
        <Card as="form" noValidate onSubmit={onSubmit} className={styles.form}>
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Checkbox label={c.agreeLabel} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <div className={styles.actions}>
            <Button type="submit" disabled={saving}>
              {saving ? c.saving : c.submit}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
