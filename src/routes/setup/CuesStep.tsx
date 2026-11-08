import { useCallback, useRef, useState } from 'react';
import { CueQuickForm } from '../../components/cues/CueQuickForm';
import { Banner, Button, Card, ChipGroup, ChoiceChip, Tag } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { CueType, NewCue, NewMeaning } from '../../data/types';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { contextPhrase } from '../../lib/card';
import { SetupFrame } from './SetupFrame';
import styles from './Setup.module.css';
import { useStepNav } from './useStepNav';

const s = copy.setup.cues;
const STARTER_COUNT = 3;

export function CuesStep() {
  const { cues, addCue } = useFamilyData();
  const { busy, goNext } = useStepNav(5);
  const [formType, setFormType] = useState<CueType | null>(null);
  const [dirty, setDirty] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const continueAfterAdd = useRef(false);

  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  async function onAdd(cue: NewCue, meaning: NewMeaning) {
    await addCue(cue, meaning);
    setFormType(null);
    setJustAdded(true);
    if (continueAfterAdd.current) {
      continueAfterAdd.current = false;
      void goNext();
    }
  }

  // "Save and continue" adds a half-written cue rather than dropping it. If it isn't complete,
  // the form shows what's missing and the family stays here.
  function onPrimary() {
    if (formType && dirty) {
      continueAfterAdd.current = true;
      formRef.current?.requestSubmit();
      return;
    }
    void goNext();
  }

  return (
    <SetupFrame
      step={5}
      heading={s.heading}
      intro={s.intro}
      writingTips
      busy={busy}
      onPrimary={onPrimary}
      onSkip={() => void goNext()}
    >
      {cues.length ? (
        <Card>
          <h2 className="t-h3">{s.addedHeading}</h2>
          <ul className={styles.added}>
            {cues.map((cue) => {
              const first = cue.cue_meanings[0];
              const where = first ? contextPhrase(first.context_tags, first.context_text) : '';
              return (
                <li key={cue.id} className={styles.addedItem}>
                  <strong>{cue.label}</strong>
                  {first ? (
                    <span>
                      {where ? `${where}: ` : ''}
                      {first.meaning} <Tag tone="rose">{copy.labels.confidence[first.confidence]}</Tag>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {justAdded && !formType ? <Banner tone="success">{copy.cueForm.added}</Banner> : null}
      {cues.length >= STARTER_COUNT && !formType ? <p>{s.enough}</p> : null}

      {formType ? (
        <Card>
          <CueQuickForm
            initialType={formType}
            onAdd={onAdd}
            formRef={formRef}
            onDirtyChange={onDirtyChange}
            onInvalid={() => {
              continueAfterAdd.current = false;
            }}
          />
        </Card>
      ) : (
        <div className={styles.examples}>
          <p className="t-small" id="cue-examples">
            <strong>{cues.length ? s.addAnother : s.examplesLabel}</strong>
          </p>
          <ChipGroup aria-labelledby="cue-examples">
            {s.examples.map((example) => (
              <ChoiceChip
                key={example.type}
                selected={false}
                onClick={() => {
                  setJustAdded(false);
                  setFormType(example.type as CueType);
                }}
              >
                {example.label}
              </ChoiceChip>
            ))}
          </ChipGroup>
        </div>
      )}

      {formType ? (
        <div>
          <Button variant="secondary" onClick={() => setFormType(null)}>
            {copy.common.cancel}
          </Button>
        </div>
      ) : null}
    </SetupFrame>
  );
}
