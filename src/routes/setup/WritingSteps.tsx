import { useMemo, useState } from 'react';
import { AboutFields } from '../../components/family/AboutFields';
import { QuestionSheet } from '../../components/family/Question';
import { SectionFields } from '../../components/family/SectionFields';
import { WhoFields, whoToSave } from '../../components/family/WhoFields';
import { copy } from '../../copy/en-AU';
import type { CardSectionKind, SectionDraft } from '../../data/types';
import { aboutDraftFrom, aboutPatch, phoneLooksValid, sectionDraftFrom, whoDraftFrom } from '../../family/drafts';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useCardModel } from '../../family/useCardModel';
import { buildCard, sectionLines, type CardModel } from '../../lib/card';
import { useAutosave } from '../../lib/useAutosave';
import { SectionPreview } from './SectionPreview';
import { SetupFrame } from './SetupFrame';
import styles from './Setup.module.css';
import { useStepNav } from './useStepNav';

const s = copy.setup;

/** The child's name for questions: what's typed, or "your child". */
function useChildName(): string {
  const { profile } = useFamilyData();
  return profile.display_name.trim() || s.yourChild;
}

/** The card with some sections swapped for what's being typed, so the preview keeps up with every key. */
function withDrafts(model: CardModel, drafts: Partial<Record<CardSectionKind, SectionDraft>>): CardModel {
  return {
    ...model,
    sections: model.sections.map((block) => {
      const draft = drafts[block.key];
      return draft ? { ...block, lines: sectionLines(block.key, draft) } : block;
    }),
  };
}

export function AboutStep() {
  const { profile, sections, cues, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => aboutDraftFrom(profile));
  const { state, flush } = useAutosave(draft, (d) => saveProfile(aboutPatch(d)));
  const { busy, goNext } = useStepNav(1);
  const model = useMemo(
    () => buildCard({ ...profile, ...aboutPatch(draft) }, sections, cues, s.yourChild),
    [profile, sections, cues, draft],
  );
  // The tips and what setup involves are said once, here, the first time through.
  const firstTime = !profile.setup_completed_at;

  return (
    <SetupFrame
      step={1}
      heading={s.about.heading}
      intro={firstTime ? s.start.lead : s.about.intro}
      aside={
        firstTime ? (
          <ul className={styles.tips}>
            {s.start.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        ) : null
      }
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
      preview={<SectionPreview model={model} parts={['about']} />}
    >
      <QuestionSheet>
        <AboutFields draft={draft} onChange={setDraft} />
      </QuestionSheet>
    </SetupFrame>
  );
}

export function SectionStep({ step, section }: { step: 2 | 3; section: 'toileting' | 'food_drink' }) {
  const { sections, saveSection } = useFamilyData();
  const name = useChildName();
  const { model } = useCardModel();
  const [draft, setDraft] = useState(() => sectionDraftFrom(sections, section));
  const { state, flush } = useAutosave(draft, (d) => saveSection(section, d));
  const { busy, goNext } = useStepNav(step);
  const text = section === 'toileting' ? s.toileting : s.food;

  return (
    <SetupFrame
      step={step}
      heading={text.heading}
      intro={text.intro(name)}
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
      preview={<SectionPreview model={withDrafts(model, { [section]: draft })} parts={[section]} />}
    >
      <QuestionSheet>
        <SectionFields section={section} name={name} draft={draft} onChange={setDraft} />
      </QuestionSheet>
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
  const name = useChildName();
  const { model } = useCardModel();
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
      intro={s.calming.intro(name)}
      autosave={state}
      busy={busy}
      onPrimary={() => void goNext(flush)}
      onSkip={() => void goNext(flush)}
      preview={<SectionPreview model={withDrafts(model, draft)} parts={['overstimulation', 'calms', 'avoid']} />}
    >
      <QuestionSheet>
        <SectionFields
          section="overstimulation"
          name={name}
          draft={draft.overstimulation}
          onChange={(overstimulation) => setDraft((d) => ({ ...d, overstimulation }))}
        />
        <SectionFields section="calms" name={name} draft={draft.calms} onChange={(calms) => setDraft((d) => ({ ...d, calms }))} />
        <SectionFields section="avoid" name={name} draft={draft.avoid} onChange={(avoid) => setDraft((d) => ({ ...d, avoid }))} />
      </QuestionSheet>
    </SetupFrame>
  );
}

export function WhoStep() {
  const { profile, saveProfile } = useFamilyData();
  const name = useChildName();
  const { model } = useCardModel();
  const [draft, setDraft] = useState(() => whoDraftFrom(profile));
  const [strict, setStrict] = useState(false);
  const toSave = whoToSave(draft, profile.who_to_call_phone);
  const { state, flush } = useAutosave(toSave, (d) => saveProfile(d));
  const { busy, goNext } = useStepNav(5);
  const preview: CardModel = {
    ...model,
    whoToCall: toSave.who_to_call_phone ? { name: toSave.who_to_call_name, phone: toSave.who_to_call_phone } : null,
  };

  return (
    <SetupFrame
      step={5}
      heading={s.who.heading}
      intro={s.who.intro(name)}
      autosave={state}
      busy={busy}
      onPrimary={() => {
        // A half-typed number isn't saved, so say so here rather than on the card-ready page.
        if (!phoneLooksValid(draft.who_to_call_phone)) return setStrict(true);
        void goNext(flush);
      }}
      onSkip={() => void goNext(flush)}
      preview={<SectionPreview model={preview} parts={['who']} />}
    >
      <QuestionSheet>
        <WhoFields draft={draft} onChange={setDraft} strict={strict} />
      </QuestionSheet>
    </SetupFrame>
  );
}
