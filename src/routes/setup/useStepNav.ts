import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logEvent } from '../../data/events';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { nextPath, SETUP_STEPS } from './steps';

/**
 * Moves between setup steps. Saves anything pending first and records the furthest step
 * reached, so the family comes back to where they left off.
 */
export function useStepNav(step: number) {
  const { profile, saveProfile } = useFamilyData();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function goNext(flush?: () => Promise<boolean>) {
    setBusy(true);
    try {
      if (flush && !(await flush())) return;
      logEvent('onboarding_step_completed', { step });
      // The furthest step is stored (1 to 6). Reaching the card-ready page marks setup complete there.
      const next = Math.min(step + 1, SETUP_STEPS);
      if (profile.setup_step < next) await saveProfile({ setup_step: next });
      navigate(nextPath(step));
    } catch {
      // Moving on matters more than recording progress; the step's own save already succeeded.
      navigate(nextPath(step));
    } finally {
      setBusy(false);
    }
  }

  return { busy, goNext };
}
