import { FirstShiftCard, type CardPart } from '../../components/card/FirstShiftCard';
import { copy } from '../../copy/en-AU';
import { isEmptyCard, type CardModel } from '../../lib/card';
import styles from './Setup.module.css';

/** Only the given parts of the card, exactly as a worker reads them, from what the family is typing. */
export function SectionPreview({ model, parts }: { model: CardModel; parts: readonly CardPart[] }) {
  const has = (part: CardPart) => parts.includes(part);
  const only: CardModel = {
    ...model,
    note: has('about') ? model.note : '',
    about: has('about') ? model.about : [],
    sections: model.sections.filter((s) => has(s.key)),
    cues: has('cues') ? model.cues : [],
    whoToCall: has('who') ? model.whoToCall : null,
  };
  if (isEmptyCard(only)) return <p className={styles.previewEmpty}>{copy.setup.preview.empty}</p>;
  return <FirstShiftCard model={only} variant="worker" headingLevel={3} showEmergency={false} />;
}
