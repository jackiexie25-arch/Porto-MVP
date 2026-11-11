import { CardOpening, telHref } from '../components/card/FirstShiftCard';
import { PhoneIcon } from '../components/ui';
import { copy } from '../copy/en-AU';
import type { CardModel } from '../lib/card';
import { formatUntil } from '../lib/share';
import styles from './Worker.module.css';

const w = copy.worker;

/**
 * Before you start: whose child this is and how to reach the family, then the family's own note
 * as the opening line, the plain facts, and a pointer to the card.
 */
export function WorkerIntro({ model, expiresAt, minutes }: { model: CardModel; expiresAt: string; minutes: number | null }) {
  const who = model.whoToCall;
  return (
    <section className={styles.intro} aria-labelledby="worker-name">
      <div className={styles.nameRow}>
        <h1 id="worker-name" className={styles.name}>
          {model.name}
        </h1>
        {who ? (
          <a href={telHref(who.phone)} className={styles.call} aria-label={w.callLabel(who.name, who.phone)}>
            <PhoneIcon size={20} />
            <span>{w.call(who.name)}</span>
          </a>
        ) : null}
      </div>
      <p className={styles.byline}>
        {w.sharedBy(model.name)}
        <span className={styles.until}>{w.openUntil(formatUntil(expiresAt))}</span>
      </p>
      <h2 className={styles.kicker}>{w.beforeHeading}</h2>
      <CardOpening model={model} className={styles.opening} />
      {minutes !== null ? (
        <p>
          <a href="#worker-card" className={styles.readFirst}>
            {w.readFirst(model.name, minutes)}
          </a>
        </p>
      ) : null}
    </section>
  );
}
