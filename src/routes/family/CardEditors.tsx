import { useState } from 'react';
import { AboutFields } from '../../components/family/AboutFields';
import { AutosaveStatus } from '../../components/family/AutosaveStatus';
import { QuestionSheet } from '../../components/family/Question';
import { SectionFields } from '../../components/family/SectionFields';
import { WhoFields, whoToSave } from '../../components/family/WhoFields';
import { Button } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { CardSectionKind } from '../../data/types';
import { aboutDraftFrom, aboutPatch, phoneLooksValid, sectionDraftFrom, whoDraftFrom } from '../../family/drafts';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useAutosave, type AutosaveState } from '../../lib/useAutosave';
import styles from './CardPage.module.css';

/** The editors sit under a part's own heading (the card page) or a section heading (account). */
const look = { compact: true, level: 3 } as const;

function EditorFooter({ state, onDone, doneLabel }: { state: AutosaveState; onDone?: () => void; doneLabel?: string }) {
  return (
    <div className={styles.editorFooter}>
      {onDone ? (
        <Button variant="outlined" onClick={onDone} aria-label={doneLabel}>
          {copy.card.done}
        </Button>
      ) : null}
      <AutosaveStatus state={state} />
    </div>
  );
}

interface EditorProps {
  /** Without onDone it stays open and just saves as the family types (used on the account page). */
  onDone?: () => void;
  /** Spoken name for Done, such as "Done with Toileting". */
  doneLabel?: string;
}

export function AboutEditor({ onDone, doneLabel }: EditorProps) {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => aboutDraftFrom(profile));
  const { state, flush } = useAutosave(draft, (d) => saveProfile(aboutPatch(d)));
  return (
    <>
      <QuestionSheet flat>
        <AboutFields draft={draft} onChange={setDraft} {...look} />
      </QuestionSheet>
      <EditorFooter state={state} doneLabel={doneLabel} onDone={onDone && (() => void flush().then((ok) => ok && onDone()))} />
    </>
  );
}

export function SectionEditor({ section, onDone, doneLabel }: EditorProps & { section: CardSectionKind; onDone: () => void }) {
  const { profile, sections, saveSection } = useFamilyData();
  const [draft, setDraft] = useState(() => sectionDraftFrom(sections, section));
  const { state, flush } = useAutosave(draft, (d) => saveSection(section, d));
  const name = profile.display_name.trim() || copy.setup.yourChild;
  return (
    <>
      <QuestionSheet flat>
        <SectionFields section={section} name={name} draft={draft} onChange={setDraft} {...look} />
      </QuestionSheet>
      <EditorFooter state={state} doneLabel={doneLabel} onDone={() => void flush().then((ok) => ok && onDone())} />
    </>
  );
}

export function WhoEditor({ onDone, doneLabel }: EditorProps) {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => whoDraftFrom(profile));
  const [strict, setStrict] = useState(false);
  const { state, flush } = useAutosave(whoToSave(draft, profile.who_to_call_phone), (d) => saveProfile(d));
  return (
    <>
      <QuestionSheet flat>
        <WhoFields draft={draft} onChange={setDraft} strict={strict} {...look} />
      </QuestionSheet>
      <EditorFooter
        state={state}
        doneLabel={doneLabel}
        onDone={
          onDone &&
          (() => {
            setStrict(true);
            void flush().then((ok) => ok && phoneLooksValid(draft.who_to_call_phone) && onDone());
          })
        }
      />
    </>
  );
}
