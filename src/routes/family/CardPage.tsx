import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FirstShiftCard } from '../../components/card/FirstShiftCard';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Banner, Button, ButtonLink, Card, Tag } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import type { CardSectionKind } from '../../data/types';
import { useCardModel } from '../../family/useCardModel';
import type { CardLine } from '../../lib/card';
import { usePageTitle } from '../../lib/usePageTitle';
import { AboutEditor, SectionEditor, WhoEditor } from './CardEditors';
import styles from './CardPage.module.css';

const c = copy.card;

function Lines({ lines }: { lines: readonly CardLine[] }) {
  if (!lines.length) return <p className="t-muted">{c.emptyFamily}</p>;
  return (
    <dl className={styles.lines}>
      {lines.map((line, i) => (
        <div key={line.label ?? i}>
          {line.label ? <dt>{line.label}</dt> : null}
          <dd>{line.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A card section that shows what's there and opens its own editor in place. */
function EditableSection({
  title,
  children,
  editor,
}: {
  title: string;
  children: ReactNode;
  editor: (close: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Card as="section" aria-label={title}>
      <div className={styles.sectionHeader}>
        <h2 className="t-h3">{title}</h2>
        {!editing ? (
          <Button variant="outlined" onClick={() => setEditing(true)} aria-label={c.editSection(title)}>
            {c.edit}
          </Button>
        ) : null}
      </div>
      {editing ? editor(() => setEditing(false)) : children}
    </Card>
  );
}

export function CardPage() {
  usePageTitle(c.title);
  const { model, words, minutes, isLong, hasName } = useCardModel();
  const [preview, setPreview] = useState(false);
  const heading = hasName ? c.heading(model.name) : c.headingNoName;

  return (
    <FamilyShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{heading}</h1>
          <p className={styles.readingTime}>{c.readingTime(words, minutes)}</p>
          <div className={styles.actions}>
            <Button variant="outlined" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? c.editButton : c.previewButton}
            </Button>
            <ButtonLink to="/card/print" variant="secondary">
              {c.printLink}
            </ButtonLink>
          </div>
          {isLong ? <Banner tone="info">{c.longNote}</Banner> : null}
          <p className="t-small t-muted">{c.medical}</p>
        </header>

        {preview ? (
          <section aria-label={c.previewHeading} className={styles.preview}>
            <h2 className="t-h3">{c.previewHeading}</h2>
            <FirstShiftCard model={model} variant="worker" headingLevel={3} />
          </section>
        ) : (
          <div className={styles.sections}>
            <EditableSection title={c.sections.about(model.name)} editor={(close) => <AboutEditor onDone={close} />}>
              <Lines lines={model.about.map((text) => ({ text }))} />
            </EditableSection>

            {model.sections.map((section) => (
              <EditableSection
                key={section.key}
                title={section.title}
                editor={(close) => <SectionEditor section={section.key as CardSectionKind} onDone={close} />}
              >
                <Lines lines={section.lines} />
              </EditableSection>
            ))}

            <Card as="section" aria-label={c.sections.cues}>
              <h2 className="t-h3">{c.sections.cues}</h2>
              {model.cues.length ? (
                <ul className={styles.cueList}>
                  {model.cues.map((cue) => (
                    <li key={cue.id}>
                      <strong>{cue.label}</strong>
                      {cue.meanings.map((m, i) => (
                        <span key={i} className={styles.cueMeaning}>
                          {m.context ? `${m.context}: ` : ''}
                          {m.meaning} <Tag tone="rose">{copy.labels.confidence[m.confidence]}</Tag>
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="t-muted">{c.cuesEmpty}</p>
              )}
              <p>
                <Link to="/setup/5">{c.addCues}</Link>
              </p>
            </Card>

            <EditableSection title={c.sections.who} editor={(close) => <WhoEditor onDone={close} />}>
              {model.whoToCall ? (
                <p>{c.who.callLine(model.whoToCall.name, model.whoToCall.phone)}</p>
              ) : (
                <p className="t-muted">{c.emptyFamily}</p>
              )}
            </EditableSection>
          </div>
        )}
      </div>
    </FamilyShell>
  );
}
