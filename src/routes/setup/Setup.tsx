import { useEffect, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { CuesStep } from './CuesStep';
import { PreviewStep } from './PreviewStep';
import { SETUP_STEPS } from './SetupFrame';
import { AboutStep, CalmingStep, SectionStep } from './WritingSteps';

/** Where /setup should resume: step 1 once setup is done (to revisit answers), else where they left off. */
export function resumeStep(setupStep: number, completed: boolean): number {
  if (completed) return 1;
  return Math.min(Math.max(setupStep, 1), SETUP_STEPS);
}

export function SetupResume() {
  const { profile } = useFamilyData();
  return <Navigate to={`/setup/${resumeStep(profile.setup_step, Boolean(profile.setup_completed_at))}`} replace />;
}

/** Guided setup. Every step is skippable and saves as the family types. */
export function Setup() {
  const { step: param } = useParams();
  const { profile, saveProfile } = useFamilyData();
  const step = Number(param);
  const started = useRef(false);

  // Record when setup started, for the "about 15 minutes" measure.
  useEffect(() => {
    if (!profile.setup_started_at && !started.current) {
      started.current = true;
      void saveProfile({ setup_started_at: new Date().toISOString() }).catch(() => undefined);
    }
  }, [profile.setup_started_at, saveProfile]);

  if (!Number.isInteger(step) || step < 1 || step > SETUP_STEPS) return <SetupResume />;

  // Keyed by step so each step mounts fresh and flushes its autosave when left.
  switch (step) {
    case 1:
      return <AboutStep key="1" />;
    case 2:
      return <SectionStep key="2" step={2} section="toileting" />;
    case 3:
      return <SectionStep key="3" step={3} section="food_drink" />;
    case 4:
      return <CalmingStep key="4" />;
    case 5:
      return <CuesStep key="5" />;
    default:
      return <PreviewStep key="6" />;
  }
}
