import { useEffect, useState, type ReactNode } from 'react';
import appIconUrl from '../assets/brand/porto-app-icon.svg';
import { CalmWave, ChecklistSun, QuietCorner, SideBySide, WorkerPhone } from '../assets/illustrations';
import { AppShell } from '../components/layout/AppShell';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  ChoiceChip,
  FieldSet,
  FieldStack,
  Mark,
  Nav,
  Progress,
  Select,
  Sheet,
  Tag,
  TextArea,
  TextField,
  Wordmark,
} from '../components/ui';
import { copy } from '../copy/en-AU';
import { usePageTitle } from '../lib/usePageTitle';
import styles from './Styleguide.module.css';

const c = copy.styleguide;

const COLOURS = [
  '--ground',
  '--surface',
  '--blob',
  '--ink',
  '--ink-soft',
  '--muted',
  '--control-border',
  '--apricot',
  '--apricot-deep',
  '--sky',
  '--rose',
  '--success',
] as const;

const SPACES = ['--space-2', '--space-3', '--space-4', '--space-6', '--space-8', '--space-12', '--space-16'] as const;
const RADII = ['--radius-sm', '--radius-md', '--radius-lg'] as const;

function useTokenValue(name: string): string {
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);
  return value;
}

function Swatch({ name }: { name: string }) {
  const value = useTokenValue(name);
  return (
    <li className={styles.swatch}>
      <span className={styles.chipColour} style={{ background: `var(${name})` }} aria-hidden="true" />
      <code className={styles.code}>{name}</code>
      <span className="t-small t-muted">{value}</span>
    </li>
  );
}

function SpaceBar({ name }: { name: string }) {
  const value = useTokenValue(name);
  return (
    <li className={styles.spaceRow}>
      <code className={styles.code}>{name}</code>
      <span className={styles.spaceBar} style={{ width: `var(${name})` }} aria-hidden="true" />
      <span className="t-small t-muted">{value}</span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Styleguide() {
  usePageTitle(c.title);
  const [chosen, setChosen] = useState<string>(c.chips.places[0]);
  const [checks, setChecks] = useState({ speech: false, sounds: true, gestures: true });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notes, setNotes] = useState('');

  return (
    <AppShell width="wide">
      <header className={styles.intro}>
        <h1>{c.heading}</h1>
        <p className="t-body-lg">{c.intro}</p>
      </header>

      <Section title={c.sections.colour}>
        <ul className={styles.swatches}>
          {COLOURS.map((name) => (
            <Swatch key={name} name={name} />
          ))}
        </ul>
      </Section>

      <Section title={c.sections.type}>
        <div className={styles.typeStack}>
          <p className="t-hero">{c.typeSamples.hero}</p>
          <p className="t-h2">{c.typeSamples.h2}</p>
          <p className="t-h3">{c.typeSamples.h3}</p>
          <p className="t-body-lg">{c.typeSamples.bodyLg}</p>
          <p className="t-body">{c.typeSamples.body}</p>
          <p className="t-small t-muted">{c.typeSamples.small}</p>
          <p className="t-button">{c.typeSamples.button}</p>
        </div>
      </Section>

      <Section title={c.sections.spacing}>
        <ul className={styles.spaces}>
          {SPACES.map((name) => (
            <SpaceBar key={name} name={name} />
          ))}
        </ul>
        <ul className={styles.radii}>
          {RADII.map((name) => (
            <li key={name} className={styles.radius} style={{ borderRadius: `var(${name})` }}>
              <code className={styles.code}>{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={c.sections.logo}>
        <div className={styles.logos}>
          <figure className={styles.logoOnGround}>
            <Wordmark width={176} />
            <figcaption className="t-small t-muted">{c.logoWordmark}</figcaption>
          </figure>
          <figure className={styles.logoOnSurface}>
            <Wordmark width={176} />
            <figcaption className="t-small t-muted">{c.logoWordmarkSurface}</figcaption>
          </figure>
          <figure className={styles.logoOnSurface}>
            <Mark size={64} />
            <figcaption className="t-small t-muted">{c.logoMark}</figcaption>
          </figure>
          <figure className={styles.logoOnSurface}>
            <img src={appIconUrl} width={64} height={64} alt={copy.layout.logoAlt} />
            <figcaption className="t-small t-muted">{c.logoAppIcon}</figcaption>
          </figure>
        </div>
      </Section>

      <Section title={c.sections.buttons}>
        <div className={styles.row}>
          <Button>{c.buttons.primary}</Button>
          <Button variant="outlined">{c.buttons.outlined}</Button>
          <Button variant="secondary">{c.buttons.secondary}</Button>
        </div>
        <div className={styles.row}>
          <Button disabled>{c.buttons.primaryDisabled}</Button>
          <span className="t-small t-muted">{c.buttons.disabledNote}</span>
        </div>
      </Section>

      <Section title={c.sections.fields}>
        <Card className={styles.formCard}>
          <FieldStack>
            <TextField label={c.fields.nameLabel} hint={c.fields.nameHint} placeholder={c.fields.namePlaceholder} />
            <TextArea
              label={c.fields.notesLabel}
              hint={c.fields.notesHint}
              optional
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Select
              label={c.fields.selectLabel}
              defaultValue="usually"
              options={[
                { value: 'always', label: c.fields.selectOptions.always },
                { value: 'usually', label: c.fields.selectOptions.usually },
                { value: 'sometimes', label: c.fields.selectOptions.sometimes },
              ]}
            />
            <FieldSet legend={c.fields.checkboxGroup}>
              <Checkbox
                label={c.fields.checkboxSpeech}
                checked={checks.speech}
                onChange={(e) => setChecks({ ...checks, speech: e.target.checked })}
              />
              <Checkbox
                label={c.fields.checkboxSounds}
                checked={checks.sounds}
                onChange={(e) => setChecks({ ...checks, sounds: e.target.checked })}
              />
              <Checkbox
                label={c.fields.checkboxGestures}
                checked={checks.gestures}
                onChange={(e) => setChecks({ ...checks, gestures: e.target.checked })}
              />
            </FieldSet>
            <TextField
              label={c.fields.errorLabel}
              defaultValue={c.fields.errorValue}
              error={c.fields.errorMessage}
              inputMode="tel"
            />
          </FieldStack>
        </Card>
      </Section>

      <Section title={c.sections.cards}>
        <Card className={styles.formCard}>
          <h3>{c.card.heading}</h3>
          <p>{c.card.body}</p>
          <p className="t-small t-muted">{c.card.caption}</p>
        </Card>
      </Section>

      <Section title={c.sections.nav}>
        <div className={styles.navFrame}>
          <Nav
            links={[
              { to: '/styleguide#cues', label: c.navLinks.cues },
              { to: '/styleguide#card', label: c.navLinks.card },
              { to: '/styleguide#inbox', label: c.navLinks.inbox },
            ]}
            primary={{ to: '/styleguide#share', label: c.navPrimary }}
          />
        </div>
      </Section>

      <Section title={c.sections.chips}>
        <div className={styles.row}>
          <Tag>{c.chips.tagHome}</Tag>
          <Tag>{c.chips.tagSchool}</Tag>
          <Tag tone="rose">{c.chips.tagRose}</Tag>
        </div>
        <p className="t-small" id="chip-group-label">
          <strong>{c.chips.chipGroup}</strong>
        </p>
        <ChipGroup aria-labelledby="chip-group-label">
          {c.chips.places.map((place) => (
            <ChoiceChip key={place} selected={chosen === place} onClick={() => setChosen(place)}>
              {place}
            </ChoiceChip>
          ))}
        </ChipGroup>
      </Section>

      <Section title={c.sections.banners}>
        <div className={styles.stack}>
          <Banner tone="success">{c.banners.success}</Banner>
          <Banner tone="error">{c.banners.error}</Banner>
          <Banner tone="info">{c.banners.info}</Banner>
        </div>
      </Section>

      <Section title={c.sections.progress}>
        <Progress current={2} total={6} label={c.progressLabel} />
      </Section>

      <Section title={c.sections.sheet}>
        <div>
          <Button variant="outlined" onClick={() => setSheetOpen(true)}>
            {c.sheet.open}
          </Button>
        </div>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={c.sheet.title}>
          <p>{c.sheet.body}</p>
          <div className={styles.row}>
            <Button onClick={() => setSheetOpen(false)}>{c.sheet.yes}</Button>
            <Button variant="outlined" onClick={() => setSheetOpen(false)}>
              {c.sheet.no}
            </Button>
          </div>
        </Sheet>
      </Section>

      <Section title={c.sections.illustrations}>
        <ul className={styles.illustrations}>
          <li>
            <SideBySide label={copy.illustrations.welcome} />
            <p className="t-small t-muted">1. {copy.illustrations.welcome}</p>
          </li>
          <li>
            <WorkerPhone label={copy.illustrations.workerPhone} />
            <p className="t-small t-muted">2. {copy.illustrations.workerPhone}</p>
          </li>
          <li>
            <QuietCorner label={copy.illustrations.quietCorner} />
            <p className="t-small t-muted">3. {copy.illustrations.quietCorner}</p>
          </li>
          <li>
            <ChecklistSun label={copy.illustrations.checklist} />
            <p className="t-small t-muted">4. {copy.illustrations.checklist}</p>
          </li>
          <li>
            <CalmWave label={copy.illustrations.calmWave} />
            <p className="t-small t-muted">5. {copy.illustrations.calmWave}</p>
          </li>
        </ul>
      </Section>
    </AppShell>
  );
}
