import { useState } from 'react';
import { MeaningView } from '../components/cues/MeaningView';
import { Button } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { ContextTag } from '../data/types';
import { cardMeaning, contextPhrase } from '../lib/card';
import { arrangeMeanings } from './arrange';
import type { SearchHit } from './types';
import styles from './Worker.module.css';

const w = copy.worker;

/**
 * "Show it large": the meaning for here at arm's-length size, to hold out to a colleague.
 * The other places sit at the foot of the screen as buttons that switch the view.
 */
export function LargeView({ hit, place }: { hit: SearchHit; place: ContextTag | null }) {
  const { lead, others } = arrangeMeanings(hit.meanings, place);
  const ordered = [...lead, ...others];
  const [shown, setShown] = useState(0);
  const current = ordered[shown];
  if (!current) return null;
  const rest = ordered.map((m, i) => ({ m, i })).filter(({ i }) => i !== shown);
  return (
    <div className={styles.large}>
      <MeaningView meaning={cardMeaning(current)} density="large" />
      {rest.length ? (
        <div className={styles.largeOther}>
          <p className={styles.othersLabel}>{w.largeOther}</p>
          {rest.map(({ m, i }) => {
            const where = contextPhrase(m.context_tags, m.context_text) || copy.meaning.anywhere;
            return (
              <Button key={i} variant="outlined" onClick={() => setShown(i)} aria-label={w.largeOtherLabel(where)}>
                {where}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
