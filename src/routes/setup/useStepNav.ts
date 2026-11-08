import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFamilyData } from '../../family/FamilyDataProvider';

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
      const next = step + 1;
      if (profile.setup_step < next) await saveProfile({ setup_step: next });
      navigate(`/setup/${next}`);
    } catch {
      // Moving on matters more than recording progress; the step's own save already succeeded.
      navigate(`/setup/${step + 1}`);
    } finally {
      setBusy(false);
    }
  }

  return { busy, goNext };
}
