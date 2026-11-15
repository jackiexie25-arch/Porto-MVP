import { useId, type ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import type { CardSectionKind } from '../../data/types';
import type { CardBlock, CardModel } from '../../lib/card';
import { MeaningView } from '../cues/MeaningView';
import { PhoneIcon } from '../ui';
import styles from './FirstShiftCard.module.css';

const c = copy.card;

type Variant = 'worker' | 'print' | 'family';

/** Every part of the card, in the order a worker reads it. */
export type CardPart = 'about' | CardSectionKind | 'cues' | 'who';

/** What the family's own copy of the card adds: a quiet control per part, and changing a part in place. */
export interface FamilyCardControls {
  /** The control at the right of each part's heading ("Change" or "Add"). */
  action: (part: CardPart, title: string, empty: boolean) => ReactNode;
  /** The part being changed shows `editor` in place of what's written. */
  editing: CardPart | null;
  editor: (part: CardPart) => ReactNode;
}

interface FirstShiftCardProps {
  model: CardModel;
  /**
   * Worker: one written page whose sections fold open and shut. Print: flat and compact.
   * Family: the same page as the worker's, with every part shown (empty ones say so) and a control each.
   */
  variant: Variant;
  /** Required for the family variant. */
  family?: FamilyCardControls;
  /** Heading level for section titles, so the card fits the page it sits in. */
  headingLevel?: 2 | 3;
  /** Leave off when the page already shows the emergency line, so it isn't said twice. */
  showEmergency?: boolean;
  /** Leave off when the page already opens with the family's note and the About facts (the worker page). */
  showOpening?: boolean;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** The family's own note, set as the opening line of the card, then the plain facts. */
export function CardOpening({ model, className }: { model: CardModel; className?: string }) {
  if (!model.note && !model.about.length) return null;
  return (
    <div className={[styles.opening, className ?? ''].join(' ')}>
      {model.note ? (
        <figure className={styles.noteFigure}>
          <blockquote className={styles.note}>
            <p>{model.note}</p>
          </blockquote>
          <figcaption className={styles.noteFrom}>{c.noteFrom(model.name)}</figcaption>
        </figure>
      ) : null}
      {model.about.length ? <p className={styles.facts}>{model.about.join(' ')}</p> : null}
    </div>
  );
}

function Block({
  title,
  kind,
  variant,
  headingLevel,
  action,
  children,
}: {
  title: string;
  kind: string;
  variant: Variant;
  headingLevel: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const className = [styles.block, styles[kind] ?? ''].join(' ');
  if (variant === 'worker') {
    return (
      <details open className={className}>
        <summary className={styles.summary}>
          <Heading className={styles.title}>{title}</Heading>
          {/* The fold is labelled in words; details already tells screen readers if it's open. */}
          <span className={styles.fold} aria-hidden="true">
            <span className={styles.hide}>{c.hide}</span>
            <span className={styles.show}>{c.show}</span>
          </span>
        </summary>
        <div className={styles.body}>{children}</div>
      </details>
    );
  }
  if (variant === 'family') {
    return (
      <section className={className} aria-labelledby={headingId}>
        <div className={styles.summary}>
          <Heading id={headingId} className={styles.title}>
            {title}
          </Heading>
          {action}
        </div>
        <div className={styles.body}>{children}</div>
      </section>
    );
  }
  return (
    <section className={className}>
      <Heading className={styles.title}>{title}</Heading>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

function SectionBody({ section }: { section: CardBlock }) {
  const only = section.lines.length === 1 && !section.lines[0]!.label ? section.lines[0]! : null;
  if (only) return <p className={styles.passage}>{only.text}</p>;
  return (
    <dl className={styles.lines}>
      {section.lines.map((line) => (
        <div key={line.label} className={[styles.line, line.key === 'what_to_do' ? styles.action : ''].join(' ')}>
          <dt>{line.label}</dt>
          <dd>{line.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Gap({ children }: { children: ReactNode }) {
  return <p className={styles.gap}>{children}</p>;
}

/**
 * The first-shift card, exactly as a worker reads it: the family's note first, then the fixed
 * section order with empty sections hidden, and only what the family wrote. It never adds or guesses.
 * The family variant shows the same page with its gaps stated plainly and a control for each part.
 */
export function FirstShiftCard({
  model,
  variant,
  family,
  headingLevel = 2,
  showEmergency = true,
  showOpening = true,
}: FirstShiftCardProps) {
  const all = variant === 'family';
  const part = (key: CardPart, title: string, empty: boolean, content: ReactNode) => {
    if (empty && !all) return null;
    const editing = family?.editing === key;
    return (
      <Block
        key={key}
        kind={key}
        title={title}
        variant={variant}
        headingLevel={headingLevel}
        action={family && !editing ? family.action(key, title, empty) : undefined}
      >
        {editing && family ? family.editor(key) : content}
      </Block>
    );
  };

  const opening = !(model.note || model.about.length);
  return (
    <div className={[styles.card, styles[variant]].join(' ')}>
      {showOpening
        ? part('about', c.sections.about(model.name), opening, opening ? <Gap>{c.emptyFamily}</Gap> : <CardOpening model={model} />)
        : null}

      {model.sections.map((section) =>
        part(
          section.key,
          section.title,
          !section.lines.length,
          section.lines.length ? <SectionBody section={section} /> : <Gap>{c.emptyFamily}</Gap>,
        ),
      )}

      {part(
        'cues',
        c.sections.cues,
        !model.cues.length,
        model.cues.length ? (
          <ul className={styles.cues}>
            {model.cues.map((cue) => (
              <li key={cue.id} className={styles.cue}>
                <p className={styles.cueLabel}>{cue.label}</p>
                {cue.meanings.map((m, i) => (
                  <MeaningView key={i} meaning={m} density="brief" className={styles.meaning} />
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <Gap>{c.cuesEmpty}</Gap>
        ),
      )}

      {part(
        'who',
        c.sections.who,
        !model.whoToCall,
        model.whoToCall ? (
          variant === 'print' ? (
            <p>{c.who.callLine(model.whoToCall.name, model.whoToCall.phone)}</p>
          ) : (
            <p>
              <a href={telHref(model.whoToCall.phone)} className={styles.phone}>
                <PhoneIcon size={22} />
                <span>{c.who.callAction(model.whoToCall.name, model.whoToCall.phone)}</span>
              </a>
            </p>
          )
        ) : (
          <Gap>{c.emptyWho}</Gap>
        ),
      )}

      {showEmergency ? <p className={styles.emergency}>{copy.layout.emergency}</p> : null}
    </div>
  );
}
