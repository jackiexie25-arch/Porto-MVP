import { useState } from 'react';
import { QuietCorner } from '../../assets/illustrations';
import { AboutFields } from '../../components/family/AboutFields';
import { SectionFields } from '../../components/family/SectionFields';
import { Card, FieldStack } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { SectionDraft } from '../../data/types';
import { aboutDraftFrom, aboutPatch, sectionDraftFrom } from '../../family/drafts';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useAutosave } from '../../lib/useAutosave';
import { SetupFrame } from './SetupFrame';
import { useStepNav } from './useStepNav';

const s = copy.setup;

export function AboutStep() {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => aboutDraftFrom(profile));
  const { state, flush } = useAutosave(draft, (d) => saveProfile(aboutPatch(d)));
  const { busy, goNext } = useStepNav(1);

  return (
    <SetupFrame
      step={1}
      heading={s.about.heading}
      intro={s.about.intro}
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
    >
      <Card>
        <AboutFields draft={draft} onChange={setDraft} />
      </Card>
    </SetupFrame>
  );
}

export function SectionStep({ step, section }: { step: 2 | 3; section: 'toileting' | 'food_drink' }) {
  const { sections, saveSection } = useFamilyData();
  const [draft, setDraft] = useState(() => sectionDraftFrom(sections, section));
  const { state, flush } = useAutosave(draft, (d) => saveSection(section, d));
  const { busy, goNext } = useStepNav(step);
  const text = section === 'toileting' ? s.toileting : s.food;

  return (
    <SetupFrame
      step={step}
      heading={text.heading}
      intro={text.intro}
      writingTips
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
    >
      <Card>
        <SectionFields section={section} draft={draft} onChange={setDraft} />
      </Card>
    </SetupFrame>
  );
}

interface CalmingDraft {
  overstimulation: SectionDraft;
  calms: SectionDraft;
  avoid: SectionDraft;
}

export function CalmingStep() {
  const { sections, saveSection } = useFamilyData();
  const [draft, setDraft] = useState<CalmingDraft>(() => ({
    overstimulation: sectionDraftFrom(sections, 'overstimulation'),
    calms: sectionDraftFrom(sections, 'calms'),
    avoid: sectionDraftFrom(sections, 'avoid'),
  }));
  const { state, flush } = useAutosave(draft, async (d) => {
    await Promise.all([
      saveSection('overstimulation', d.overstimulation),
      saveSection('calms', d.calms),
      saveSection('avoid', d.avoid),
    ]);
  });
  const { busy, goNext } = useStepNav(4);

  return (
    <SetupFrame
      step={4}
      heading={s.calming.heading}
      intro={s.calming.intro}
      art={<QuietCorner />}
      writingTips
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
    >
      <Card>
        <FieldStack>
          <SectionFields
            section="overstimulation"
            draft={draft.overstimulation}
            onChange={(overstimulation) => setDraft((d) => ({ ...d, overstimulation }))}
          />
          <SectionFields section="calms" draft={draft.calms} onChange={(calms) => setDraft((d) => ({ ...d, calms }))} />
          <SectionFields section="avoid" draft={draft.avoid} onChange={(avoid) => setDraft((d) => ({ ...d, avoid }))} />
        </FieldStack>
      </Card>
    </SetupFrame>
  );
}
