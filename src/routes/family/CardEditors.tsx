import { useState } from 'react';
import { AboutFields } from '../../components/family/AboutFields';
import { AutosaveStatus } from '../../components/family/AutosaveStatus';
import { SectionFields } from '../../components/family/SectionFields';
import { Button, FieldStack, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { LIMITS, type CardSectionKind } from '../../data/types';
import { aboutDraftFrom, aboutPatch, phoneLooksValid, sectionDraftFrom, whoDraftFrom } from '../../family/drafts';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { useAutosave, type AutosaveState } from '../../lib/useAutosave';
import styles from './CardPage.module.css';

function EditorFooter({ state, onDone }: { state: AutosaveState; onDone: () => void }) {
  return (
    <div className={styles.editorFooter}>
      <AutosaveStatus state={state} />
      <Button variant="outlined" onClick={onDone}>
        {copy.card.done}
      </Button>
    </div>
  );
}

export function AboutEditor({ onDone }: { onDone: () => void }) {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => aboutDraftFrom(profile));
  const { state, flush } = useAutosave(draft, (d) => saveProfile(aboutPatch(d)));
  return (
    <>
      <AboutFields draft={draft} onChange={setDraft} />
      <EditorFooter state={state} onDone={() => void flush().then((ok) => ok && onDone())} />
    </>
  );
}

export function SectionEditor({ section, onDone }: { section: CardSectionKind; onDone: () => void }) {
  const { sections, saveSection } = useFamilyData();
  const [draft, setDraft] = useState(() => sectionDraftFrom(sections, section));
  const { state, flush } = useAutosave(draft, (d) => saveSection(section, d));
  return (
    <>
      <SectionFields section={section} draft={draft} onChange={setDraft} />
      <EditorFooter state={state} onDone={() => void flush().then((ok) => ok && onDone())} />
    </>
  );
}

export function WhoEditor({ onDone }: { onDone: () => void }) {
  const { profile, saveProfile } = useFamilyData();
  const [draft, setDraft] = useState(() => whoDraftFrom(profile));
  const phoneOk = phoneLooksValid(draft.who_to_call_phone);
  // An unfinished phone number isn't saved; the last good one stays until it's fixed.
  const toSave = {
    who_to_call_name: draft.who_to_call_name.trim(),
    who_to_call_phone: phoneOk ? draft.who_to_call_phone.trim() : profile.who_to_call_phone,
  };
  const { state, flush } = useAutosave(toSave, (d) => saveProfile(d));
  const w = copy.card.who;
  return (
    <>
      <p className="t-small t-muted">{w.note}</p>
      <FieldStack>
        <TextField
          label={w.nameLabel}
          autoComplete="off"
          maxLength={LIMITS.name}
          value={draft.who_to_call_name}
          onChange={(e) => setDraft({ ...draft, who_to_call_name: e.target.value })}
        />
        <TextField
          label={w.phoneLabel}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={LIMITS.phone}
          value={draft.who_to_call_phone}
          onChange={(e) => setDraft({ ...draft, who_to_call_phone: e.target.value })}
          error={phoneOk ? undefined : w.phoneInvalid}
        />
      </FieldStack>
      <EditorFooter state={state} onDone={() => void flush().then((ok) => ok && phoneOk && onDone())} />
    </>
  );
}
