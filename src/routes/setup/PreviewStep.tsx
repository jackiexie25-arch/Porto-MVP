import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChecklistSun } from '../../assets/illustrations';
import { FirstShiftCard } from '../../components/card/FirstShiftCard';
import { Banner } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useCardModel } from '../../family/useCardModel';
import { friendlyError } from '../../lib/errors';
import { SetupFrame } from './SetupFrame';
import styles from './Setup.module.css';

const s = copy.setup.preview;

export function PreviewStep() {
  const { profile, saveProfile } = useFamilyData();
  const { model, words, minutes, isLong } = useCardModel();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function finish() {
    setBusy(true);
    setError(undefined);
    try {
      if (!profile.setup_completed_at) {
        await saveProfile({ setup_step: 6, setup_completed_at: new Date().toISOString() });
      }
      navigate('/card');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SetupFrame
      step={6}
      heading={s.heading}
      intro={s.intro}
      art={<ChecklistSun />}
      primaryLabel={s.finish}
      showSkip={false}
      busy={busy}
      onPrimary={() => void finish()}
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      <p className={styles.readingTime}>{copy.card.readingTime(words, minutes)}</p>
      {isLong ? <Banner tone="info">{copy.card.longNote}</Banner> : null}
      <FirstShiftCard model={model} variant="worker" />
      <p>{s.ready}</p>
    </SetupFrame>
  );
}
