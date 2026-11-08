import type { ReactNode } from 'react';
import { copy } from '../../copy/en-AU';
import type { CardModel } from '../../lib/card';
import { Tag } from '../ui';
import styles from './FirstShiftCard.module.css';

const c = copy.card;

interface FirstShiftCardProps {
  model: CardModel;
  /** Worker view: each section folds open and shut. Print: flat and compact. */
  variant: 'worker' | 'print';
  /** Heading level for section titles, so the card fits the page it sits in. */
  headingLevel?: 2 | 3;
  /** Leave off when the page already shows the emergency line, so it isn't said twice. */
  showEmergency?: boolean;
}

function Block({
  title,
  variant,
  headingLevel,
  children,
}: {
  title: string;
  variant: FirstShiftCardProps['variant'];
  headingLevel: 2 | 3;
  children: ReactNode;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  if (variant === 'worker') {
    return (
      <details open className={styles.block}>
        <summary className={styles.summary}>
          <Heading className={`t-h3 ${styles.title}`}>{title}</Heading>
        </summary>
        <div className={styles.body}>{children}</div>
      </details>
    );
  }
  return (
    <section className={styles.block}>
      <Heading className={`t-h3 ${styles.title}`}>{title}</Heading>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/**
 * The first-shift card, exactly as a worker reads it: fixed section order, empty sections hidden,
 * and only what the family wrote. It never adds or guesses anything.
 */
export function FirstShiftCard({ model, variant, headingLevel = 2, showEmergency = true }: FirstShiftCardProps) {
  return (
    <div className={[styles.card, styles[variant]].join(' ')}>
      {model.about.length ? (
        <Block title={c.sections.about(model.name)} variant={variant} headingLevel={headingLevel}>
          {model.about.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </Block>
      ) : null}

      {model.sections
        .filter((s) => s.lines.length)
        .map((section) => (
          <Block key={section.key} title={section.title} variant={variant} headingLevel={headingLevel}>
            {section.lines.length === 1 && !section.lines[0]!.label ? (
              <p>{section.lines[0]!.text}</p>
            ) : (
              <dl className={styles.lines}>
                {section.lines.map((line) => (
                  <div key={line.label} className={styles.line}>
                    <dt>{line.label}</dt>
                    <dd>{line.text}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Block>
        ))}

      {model.cues.length ? (
        <Block title={c.sections.cues} variant={variant} headingLevel={headingLevel}>
          <ul className={styles.cues}>
            {model.cues.map((cue) => (
              <li key={cue.id} className={styles.cue}>
                <p className={styles.cueLabel}>{cue.label}</p>
                {cue.meanings.map((m, i) => (
                  <div key={i} className={styles.meaning}>
                    <p>
                      {m.context ? <strong>{m.context}: </strong> : null}
                      {m.meaning} <Tag tone="rose">{copy.labels.confidence[m.confidence]}</Tag>
                    </p>
                    {m.whatToDo ? (
                      <p>
                        <strong>{c.tryLabel}: </strong>
                        {m.whatToDo}
                      </p>
                    ) : null}
                    {m.whatToAvoid ? (
                      <p>
                        <strong>{c.avoidLabel}: </strong>
                        {m.whatToAvoid}
                      </p>
                    ) : null}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {model.whoToCall ? (
        <Block title={c.sections.who} variant={variant} headingLevel={headingLevel}>
          <p>
            {variant === 'worker' ? (
              <a href={`tel:${model.whoToCall.phone.replace(/[^\d+]/g, '')}`} className={styles.phone}>
                {c.who.callLine(model.whoToCall.name, model.whoToCall.phone)}
              </a>
            ) : (
              c.who.callLine(model.whoToCall.name, model.whoToCall.phone)
            )}
          </p>
        </Block>
      ) : null}

      {showEmergency ? <p className={styles.emergency}>{copy.layout.emergency}</p> : null}
    </div>
  );
}
