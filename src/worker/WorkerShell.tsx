import type { MouseEvent, ReactNode } from 'react';
import { CalmWave } from '../assets/illustrations';
import { Banner, Button, Wordmark } from '../components/ui';
import { copy } from '../copy/en-AU';
import styles from './Worker.module.css';

const w = copy.worker;

/** The page frame: skip links, the wordmark, the footer with the privacy line and 000. */
export function Shell({
  name,
  demoNote,
  onSkipToSearch,
  children,
}: {
  name: string;
  demoNote?: ReactNode;
  /** Present when the link allows search: a second skip link straight to the search box. */
  onSkipToSearch?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={[styles.page, demoNote ? styles.withNote : ''].join(' ')}>
      <a className="skip-link" href="#main">
        {copy.layout.skipLink}
      </a>
      {onSkipToSearch ? (
        <a
          className="skip-link"
          href="#right-now"
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            onSkipToSearch();
          }}
        >
          {w.skipToSearch}
        </a>
      ) : null}
      <header className={styles.masthead}>
        <Wordmark width={88} />
      </header>
      {demoNote}
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <p className="t-small t-muted">{w.privacy(name)}</p>
        <p className={styles.emergency}>{copy.layout.emergency}</p>
      </footer>
    </div>
  );
}

export function ClosedView({ name }: { name?: string }) {
  return (
    <div className={styles.page}>
      <a className="skip-link" href="#main">
        {copy.layout.skipLink}
      </a>
      <main id="main" className={[styles.main, styles.closed].join(' ')}>
        <CalmWave className={styles.closedArt} />
        <h1 className="t-h2">{w.closedHeading}</h1>
        <p className="t-body-lg">{name ? w.closedBody(name) : w.closedBodyNoName}</p>
      </main>
    </div>
  );
}

export function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.page}>
      <main id="main" className={styles.main}>
        <Banner tone="error">{message}</Banner>
        <div>
          <Button variant="outlined" onClick={onRetry}>
            {w.tryAgain}
          </Button>
        </div>
      </main>
    </div>
  );
}

/** While the card loads: the page's frame, so nothing jumps when it arrives. */
export function Opening() {
  return (
    <div className={styles.page}>
      <header className={styles.masthead}>
        <Wordmark width={88} />
      </header>
      <main id="main" className={styles.main}>
        <p role="status" className={styles.openingLine}>
          {w.opening}
        </p>
      </main>
    </div>
  );
}
