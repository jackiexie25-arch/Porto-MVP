import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FirstShiftCard, partSize, type CardPart } from '../../components/card/FirstShiftCard';
import { FamilyShell } from '../../components/family/FamilyShell';
import { PageHeading } from '../../components/layout/PageHeading';
import { copy } from '../../copy/en-AU';
import { logEvent } from '../../data/events';
import { useCardModel } from '../../family/useCardModel';
import { usePageTitle } from '../../lib/usePageTitle';
import { AboutEditor, SectionEditor, WhoEditor } from './CardEditors';
import styles from './CardPage.module.css';

const c = copy.card;

/**
 * The family's card: the same single sheet a worker reads, with every part shown (empty parts say
 * so plainly) and a quiet "Change" or "Add" beside each heading that opens that part in place.
 */
export function CardPage() {
  usePageTitle(c.title);
  const { model, words, minutes, isLong, hasName } = useCardModel();
  const [editing, setEditing] = useState<CardPart | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<CardPart | null>(null);

  useEffect(() => {
    logEvent('card_viewed_by_family');
  }, []);

  // Opening a part puts the cursor in its first box; Done brings focus back to that part's control.
  useEffect(() => {
    if (editing) {
      editorRef.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    } else if (returnTo.current) {
      document.querySelector<HTMLElement>(`[data-change="${returnTo.current}"]`)?.focus();
      returnTo.current = null;
    }
  }, [editing]);

  const heading = hasName ? c.heading(model.name) : c.headingNoName;

  function action(part: CardPart, title: string, empty: boolean) {
    const text = empty ? c.add : c.change;
    const label = empty ? c.addLabel(title) : c.changeLabel(title);
    if (part === 'cues') {
      return (
        <Link to="/cues" className={styles.change} aria-label={label}>
          {text}
        </Link>
      );
    }
    return (
      <button type="button" className={styles.change} aria-label={label} data-change={part} onClick={() => setEditing(part)}>
        {text}
      </button>
    );
  }

  function editor(part: CardPart) {
    const done = () => {
      returnTo.current = part;
      setEditing(null);
    };
    const doneLabel = c.doneLabel(part === 'about' ? c.sections.about(model.name) : c.sections[part]);
    return (
      <div ref={editorRef} className={styles.editor}>
        <p className={styles.kicker}>{c.editorKicker(model.name, partSize(part))}</p>
        {part === 'about' ? (
          <AboutEditor onDone={done} doneLabel={doneLabel} />
        ) : part === 'who' ? (
          <WhoEditor onDone={done} doneLabel={doneLabel} />
        ) : part === 'cues' ? null : (
          <SectionEditor section={part} onDone={done} doneLabel={doneLabel} />
        )}
      </div>
    );
  }

  return (
    <FamilyShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <PageHeading className="t-h2">{heading}</PageHeading>
          <p className={styles.intro}>{c.intro}</p>
          <p className={styles.meta}>
            <span>{c.readingTime(words, minutes)}</span>
            <Link to="/card/print" className={styles.print}>
              {c.printLink}
            </Link>
          </p>
          {isLong ? <p className={styles.long}>{c.longNote}</p> : null}
        </header>

        <FirstShiftCard model={model} variant="family" family={{ action, editing, editor }} />
      </div>
    </FamilyShell>
  );
}
