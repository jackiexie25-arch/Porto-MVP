import { useCallback, useRef, useState } from 'react';
import { CueQuickForm, isQuickDraftDirty, type QuickDraft } from '../../components/cues/CueQuickForm';
import { MeaningView } from '../../components/cues/MeaningView';
import { QuestionSheet } from '../../components/family/Question';
import { Banner, Button, Sheet } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { NewCue, NewMeaning } from '../../data/types';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { cardMeaning } from '../../lib/card';
import { useRevealOn } from '../../lib/reveal';
import { useLeaveGuard } from '../../lib/useLeaveGuard';
import { SetupFrame } from './SetupFrame';
import styles from './Setup.module.css';
import { useStepNav } from './useStepNav';

const s = copy.setup.cues;
const STARTER_COUNT = 3;

export function CuesStep() {
  const { profile, cues, addCue } = useFamilyData();
  const name = profile.display_name.trim() || copy.setup.yourChild;
  const { busy, goNext } = useStepNav(6);
  const [formOpen, setFormOpen] = useState(cues.length < STARTER_COUNT);
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [justAdded, setJustAdded] = useState(0);
  const [asking, setAsking] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const continueAfterAdd = useRef(false);
  // After "Add this cue" the form closes; focus moves to "Added to the profile." so it isn't lost.
  const addedRef = useRevealOn<HTMLDivElement>(justAdded && !formOpen ? justAdded : 0);

  const dirty = formOpen && draft !== null && isQuickDraftDirty(draft);
  // A typed cue is never lost by leaving through the menu either.
  const guard = useLeaveGuard(dirty && !busy);
  const onDraftChange = useCallback((d: QuickDraft) => setDraft(d), []);

  async function onAdd(cue: NewCue, meaning: NewMeaning) {
    await addCue(cue, meaning);
    setFormOpen(false);
    setDraft(null);
    setJustAdded((n) => n + 1);
    if (continueAfterAdd.current) {
      continueAfterAdd.current = false;
      void goNext();
    }
  }

  function addThenContinue() {
    setAsking(false);
    continueAfterAdd.current = true;
    formRef.current?.requestSubmit();
  }

  // "Save and continue" adds a half-written cue rather than dropping it. If it isn't complete,
  // the form shows what's missing and the family stays here.
  function onPrimary() {
    if (dirty) return addThenContinue();
    void goNext();
  }

  // "Skip" with a cue started asks first, so tapping it can never throw typing away.
  function onSkip() {
    if (dirty) return setAsking(true);
    void goNext();
  }

  return (
    <SetupFrame step={6} heading={s.heading} intro={s.intro(name)} busy={busy} onPrimary={onPrimary} onSkip={onSkip}>
      {cues.length ? (
        <section aria-labelledby="added-so-far">
          <h2 id="added-so-far" className={styles.addedHead}>
            <span>{s.addedHeading}</span>
            <span className={styles.addedCount}>{s.addedCount(cues.length)}</span>
          </h2>
          <ul className={styles.added}>
            {cues.map((cue) => {
              const first = cue.cue_meanings[0];
              return (
                <li key={cue.id} className={styles.addedItem}>
                  <p className={styles.addedLabel}>{cue.label}</p>
                  {first ? <MeaningView meaning={cardMeaning(first)} density="compact" show={{ avoid: false }} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {justAdded && !formOpen ? (
        <Banner tone="success" ref={addedRef}>
          {copy.cueForm.added}
        </Banner>
      ) : null}

      {formOpen ? (
        <QuestionSheet>
          <CueQuickForm
            onAdd={onAdd}
            formRef={formRef}
            onDraftChange={onDraftChange}
            onInvalid={() => {
              continueAfterAdd.current = false;
            }}
          />
        </QuestionSheet>
      ) : (
        <div className={styles.sheetActions}>
          {cues.length >= STARTER_COUNT ? <p>{s.enough}</p> : null}
          <div>
            <Button variant="outlined" onClick={() => setFormOpen(true)}>
              {s.addAnother}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={asking} onClose={() => setAsking(false)} title={s.keepTitle}>
        <p>{s.keepBody(draft?.label.trim() ?? '')}</p>
        <div className={styles.sheetActions}>
          <div>
            <Button onClick={addThenContinue}>{s.keepAdd}</Button>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setAsking(false);
                void goNext();
              }}
            >
              {s.keepDrop}
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={guard.pending !== null} onClose={guard.stay} title={copy.cueEditor.leaveTitle}>
        <p>{s.keepBody(draft?.label.trim() ?? '')}</p>
        <div className={styles.sheetActions}>
          <div>
            <Button onClick={guard.stay}>{copy.cueEditor.leaveStay}</Button>
          </div>
          <div>
            <Button variant="secondary" onClick={guard.leave}>
              {copy.cueEditor.leaveGo}
            </Button>
          </div>
        </div>
      </Sheet>
    </SetupFrame>
  );
}
