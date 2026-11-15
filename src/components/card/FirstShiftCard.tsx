import { useId, type ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import { PART_SIZE, partWritten, type CardBlock, type CardModel, type CardPart } from '../../lib/card';
import { MeaningView } from '../cues/MeaningView';
import { PhoneIcon } from '../ui';
import styles from './FirstShiftCard.module.css';

export type { CardPart } from '../../lib/card';

const c = copy.card;

type Variant = 'worker' | 'print' | 'family' | 'preview';

/** What the family's own copy of the card adds: a quiet control per part, and changing a part in place. */
export interface FamilyCardControls {
  /** The control at the right of each part's heading ("Change" or "Add"). */
  action: (part: CardPart, title: string, empty: boolean) => ReactNode;
  /** The part being changed shows `editor` in place of what's written. */
  editing?: CardPart | null;
  editor?: (part: CardPart) => ReactNode;
}

interface FirstShiftCardProps {
  model: CardModel;
  /**
   * Worker: one written page whose sections fold open and shut. Print: flat and compact.
   * Family: the same page, every part shown; a part with nothing in it says so, with its size.
   * Preview: what a worker would read so far, with the parts being written marked and always shown.
   */
  variant: Variant;
  /** Controls for the family variant. */
  family?: FamilyCardControls;
  /** Preview: the parts being written, marked with an ink rule. */
  current?: readonly CardPart[];
  /** Family: parts the page already shows elsewhere (the card-ready page's "No one to call"). */
  hide?: readonly CardPart[];
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

/** "3 questions · about a minute", or where cues are chosen. */
export function partSize(part: CardPart): string {
  if (part === 'cues') return c.cuesSize;
  const size = PART_SIZE[part];
  return c.size(size.questions, size.minutes);
}

function Block({
  title,
  kind,
  variant,
  headingLevel,
  action,
  marked = false,
  gap = false,
  children,
}: {
  title: string;
  kind: string;
  variant: Variant;
  headingLevel: 2 | 3;
  action?: ReactNode;
  marked?: boolean;
  gap?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const className = [styles.block, styles[kind] ?? '', marked ? styles.marked : '', gap ? styles.gapPart : ''].join(' ');
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
  if (variant === 'print') {
    return (
      <section className={className}>
        <Heading className={styles.title}>{title}</Heading>
        <div className={styles.body}>{children}</div>
      </section>
    );
  }
  return (
    <section className={className} aria-labelledby={headingId} data-part={kind}>
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
 * The family and preview variants show the same page; their notes about gaps are never shown to workers.
 */
export function FirstShiftCard({
  model,
  variant,
  family,
  current = [],
  hide = [],
  headingLevel = 2,
  showEmergency = true,
  showOpening = true,
}: FirstShiftCardProps) {
  const name = model.name;

  function body(part: CardPart): ReactNode {
    if (part === 'about') return <CardOpening model={model} />;
    if (part === 'cues') {
      return (
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
      );
    }
    if (part === 'who') {
      const who = model.whoToCall!;
      return variant === 'print' ? (
        <p>{c.who.callLine(who.name, who.phone)}</p>
      ) : (
        <p>
          <a href={telHref(who.phone)} className={styles.phone}>
            <PhoneIcon size={22} />
            <span>{c.who.callAction(who.name, who.phone)}</span>
          </a>
        </p>
      );
    }
    return <SectionBody section={model.sections.find((s) => s.key === part)!} />;
  }

  function gap(part: CardPart): ReactNode {
    if (variant === 'preview') return <p className={styles.gapText}>{copy.setup.preview.current}</p>;
    const fact = part === 'who' ? c.gap.who : c.gap[part](name);
    return (
      <>
        <p className={styles.gapText}>{fact}</p>
        <p className={styles.gapSize}>{partSize(part)}</p>
      </>
    );
  }

  const parts: CardPart[] = [
    ...(showOpening ? (['about'] as const) : []),
    ...model.sections.map((s) => s.key),
    'cues',
    'who',
  ];

  return (
    <div className={[styles.card, styles[variant]].join(' ')}>
      {parts.map((part) => {
        const written = partWritten(model, part);
        const isCurrent = current.includes(part);
        const shown = variant === 'family' ? !hide.includes(part) : written || (variant === 'preview' && isCurrent);
        if (!shown) return null;
        const title = part === 'about' ? c.sections.about(name) : c.sections[part];
        const editing = family?.editing === part;
        return (
          <Block
            key={part}
            kind={part}
            title={title}
            variant={variant}
            headingLevel={headingLevel}
            marked={variant === 'preview' && isCurrent}
            gap={!written && !editing}
            action={family && !editing ? family.action(part, title, !written) : undefined}
          >
            {editing && family?.editor ? family.editor(part) : written ? body(part) : gap(part)}
          </Block>
        );
      })}

      {showEmergency ? <p className={styles.emergency}>{copy.layout.emergency}</p> : null}
    </div>
  );
}
