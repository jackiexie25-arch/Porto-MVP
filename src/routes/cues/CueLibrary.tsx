import { useId, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { WorkerPhone } from '../../assets/illustrations';
import { FamilyShell } from '../../components/family/FamilyShell';
import { Banner, Button, ButtonLink, Card, ChipGroup, ChoiceChip, Tag, TextField } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { CUE_CATEGORIES, type Cue, type CueCategory } from '../../data/types';
import { useFamilyData } from '../../family/FamilyDataProvider';
import { contextPhrase } from '../../lib/card';
import { filterCues } from '../../lib/search';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Cues.module.css';

const c = copy.cues;

function CueSummary({ cue }: { cue: Cue }) {
  return (
    <Card as="li" className={styles.cue}>
      <div className={styles.cueHeader}>
        <h2 className="t-h3">{cue.label}</h2>
        <ButtonLink to={`/cues/${cue.id}`} variant="outlined" aria-label={c.editCue(cue.label)}>
          {c.edit}
        </ButtonLink>
      </div>
      <div className={styles.tags}>
        <Tag>{copy.labels.category[cue.category]}</Tag>
        <Tag>{copy.labels.cueType[cue.cue_type]}</Tag>
        {cue.pinned ? <Tag>{c.pinned}</Tag> : null}
      </div>
      <ul className={styles.meanings}>
        {cue.cue_meanings.map((m) => {
          const where = contextPhrase(m.context_tags, m.context_text);
          return (
            <li key={m.id}>
              <p>
                {where ? <strong>{where}: </strong> : null}
                {m.meaning} <Tag tone="rose">{copy.labels.confidence[m.confidence]}</Tag>
              </p>
              {m.what_to_do ? (
                <p>
                  <strong>{copy.card.tryLabel}: </strong>
                  {m.what_to_do}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function CueLibrary() {
  usePageTitle(c.title);
  const { cues } = useFamilyData();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CueCategory | 'all'>('all');
  const filterId = useId();

  const shown = useMemo(() => filterCues(cues, query, category), [cues, query, category]);

  return (
    <FamilyShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p>{c.intro}</p>
          <div>
            <ButtonLink to="/cues/new">{c.add}</ButtonLink>
          </div>
        </header>

        {notice ? <Banner tone="success">{notice}</Banner> : null}

        {cues.length === 0 ? (
          <div className={styles.empty}>
            <WorkerPhone className={styles.art} />
            <h2 className="t-h3">{c.emptyHeading}</h2>
            <p>{c.emptyBody}</p>
          </div>
        ) : (
          <>
            <div className={styles.controls}>
              <TextField
                label={c.searchLabel}
                hint={c.searchHint}
                type="search"
                autoComplete="off"
                maxLength={200}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className={styles.filter}>
                <p id={filterId} className={styles.legend}>
                  {c.filterLabel}
                </p>
                <ChipGroup aria-labelledby={filterId}>
                  <ChoiceChip selected={category === 'all'} onClick={() => setCategory('all')}>
                    {c.all}
                  </ChoiceChip>
                  {CUE_CATEGORIES.map((k) => (
                    <ChoiceChip key={k} selected={category === k} onClick={() => setCategory(k)}>
                      {copy.labels.category[k]}
                    </ChoiceChip>
                  ))}
                </ChipGroup>
              </div>
            </div>

            <p className="t-small t-muted" role="status" aria-live="polite">
              {c.count(shown.length, cues.length)}
            </p>

            {shown.length ? (
              <ul className={styles.list}>
                {shown.map((cue) => (
                  <CueSummary key={cue.id} cue={cue} />
                ))}
              </ul>
            ) : (
              <div className={styles.noMatch}>
                <p>{c.noMatches(query.trim())}</p>
                {query ? (
                  <div>
                    <Button variant="outlined" onClick={() => setQuery('')}>
                      {c.clear}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </FamilyShell>
  );
}
