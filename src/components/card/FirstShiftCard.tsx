import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import type { CardBlock, CardModel } from '../../lib/card';
import { MeaningView } from '../cues/MeaningView';
import { PhoneIcon } from '../ui';
import styles from './FirstShiftCard.module.css';

const c = copy.card;

type Variant = 'worker' | 'print';

interface FirstShiftCardProps {
  model: CardModel;
  /** Worker view: one written page whose sections fold open and shut. Print: flat and compact. */
  variant: Variant;
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
  children,
}: {
  title: string;
  kind: string;
  variant: Variant;
  headingLevel: 2 | 3;
  children: ReactNode;
}) {
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

/**
 * The first-shift card, exactly as a worker reads it: the family's note first, then the fixed
 * section order with empty sections hidden, and only what the family wrote. It never adds or guesses.
 */
export function FirstShiftCard({ model, variant, headingLevel = 2, showEmergency = true, showOpening = true }: FirstShiftCardProps) {
  return (
    <div className={[styles.card, styles[variant]].join(' ')}>
      {showOpening && (model.note || model.about.length) ? (
        <Block kind="about" title={c.sections.about(model.name)} variant={variant} headingLevel={headingLevel}>
          <CardOpening model={model} />
        </Block>
      ) : null}

      {model.sections
        .filter((s) => s.lines.length)
        .map((section) => (
          <Block key={section.key} kind={section.key} title={section.title} variant={variant} headingLevel={headingLevel}>
            <SectionBody section={section} />
          </Block>
        ))}

      {model.cues.length ? (
        <Block kind="cues" title={c.sections.cues} variant={variant} headingLevel={headingLevel}>
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
        </Block>
      ) : null}

      {model.whoToCall ? (
        <Block kind="who" title={c.sections.who} variant={variant} headingLevel={headingLevel}>
          {variant === 'worker' ? (
            <p>
              <a href={telHref(model.whoToCall.phone)} className={styles.phone}>
                <PhoneIcon size={22} />
                <span>{c.who.callAction(model.whoToCall.name, model.whoToCall.phone)}</span>
              </a>
            </p>
          ) : (
            <p>{c.who.callLine(model.whoToCall.name, model.whoToCall.phone)}</p>
          )}
        </Block>
      ) : null}

      {showEmergency ? <p className={styles.emergency}>{copy.layout.emergency}</p> : null}
    </div>
  );
}
