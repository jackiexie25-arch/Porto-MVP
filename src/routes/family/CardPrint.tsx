import { Link } from 'react-router-dom';
import { FirstShiftCard } from '../../components/card/FirstShiftCard';
import { Button, Wordmark } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { useCardModel } from '../../family/useCardModel';
import { formatDate } from '../../lib/card';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './CardPrint.module.css';

const c = copy.card;

/** One A4 page: wordmark, name, last updated, the card and who shared it. Also saves as PDF. */
export function CardPrint() {
  usePageTitle(c.print.title);
  const { model } = useCardModel();

  return (
    <main id="main" className={styles.page}>
      <div className={styles.toolbar}>
        <Button onClick={() => window.print()}>{c.print.button}</Button>
        <Link to="/card">{c.print.back}</Link>
        <p className="t-small t-muted">{c.print.tip}</p>
      </div>

      <article className={styles.sheet}>
        <header className={styles.header}>
          <Wordmark width={96} />
          <div>
            <h1 className={styles.name}>{model.name}</h1>
            <p className={styles.meta}>{c.lastUpdated(formatDate(model.updatedAt))}</p>
          </div>
        </header>
        <FirstShiftCard model={model} variant="print" />
        <p className={styles.meta}>{c.sharedBy(model.name)}</p>
      </article>
    </main>
  );
}
