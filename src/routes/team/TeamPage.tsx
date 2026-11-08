import { useEffect, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Banner, Button, Card } from '../../components/ui';
import { copy } from '../../copy/en-AU';
import { downloadText, toCsv } from '../../lib/csv';
import { friendlyError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Team.module.css';

const c = copy.team;

type FunnelKey = keyof typeof c.funnel;
type MeasureKey = keyof typeof c.measures;
type ColumnKey = keyof typeof c.columns;

export interface TeamMetrics {
  status: 'ok';
  generated_at: string;
  funnel: Record<FunnelKey, number>;
  families: Array<Record<ColumnKey, string | number | boolean | null>>;
  [key: string]: unknown;
}

const FUNNEL: readonly FunnelKey[] = [
  'signed_up',
  'completed_onboarding',
  'created_share',
  'worker_opened',
  'worker_searched',
  'note_logged',
  'note_approved',
];
const RATES: readonly MeasureKey[] = ['zero_result_rate', 'helped_rate', 'approval_rate'];
const MEASURES: readonly MeasureKey[] = [
  'median_onboarding_minutes',
  'searches',
  'searches_per_opened_share',
  'zero_result_rate',
  'helped_rate',
  'notes_logged',
  'approval_rate',
];
const COLUMNS = Object.keys(c.columns) as ColumnKey[];

export function formatMeasure(key: MeasureKey, value: unknown): string {
  if (value === null || value === undefined) return c.none;
  const n = Number(value);
  if (RATES.includes(key)) return `${Math.round(n * 100)}%`;
  return String(n);
}

function cell(value: string | number | boolean | null): string {
  if (value === true) return c.yes;
  if (value === false) return c.no;
  return value === null ? '' : String(value);
}

/** Aggregates as CSV: the funnel, the measures and the anonymous per-family table. Nothing else. */
export function metricsCsv(m: TeamMetrics): string {
  const rows: string[][] = [['Metric', 'Value']];
  for (const k of FUNNEL) rows.push([c.funnel[k], String(m.funnel[k])]);
  for (const k of MEASURES) rows.push([c.measures[k], formatMeasure(k, m[k])]);
  rows.push([]);
  rows.push(COLUMNS.map((k) => c.columns[k]));
  for (const f of m.families) rows.push(COLUMNS.map((k) => cell(f[k] ?? null)));
  return toCsv(rows);
}

/** /team: for emails in team_members only. Totals and anonymous family labels, never content. */
export function TeamPage() {
  usePageTitle(c.title);
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().rpc('team_metrics');
        if (error) throw error;
        if (!active) return;
        if ((data as { status: string }).status === 'ok') setMetrics(data as TeamMetrics);
        else setMessage(c.notTeam);
      } catch (err) {
        if (active) setMessage(friendlyError(err));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const max = metrics ? Math.max(1, metrics.funnel.signed_up) : 1;

  return (
    <AppShell width="wide">
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className="t-h2">{c.heading}</h1>
          <p>{c.intro}</p>
        </header>

        {message ? <Banner tone="info">{message}</Banner> : null}
        {!metrics && !message ? <p className="t-muted">{copy.common.loading}</p> : null}

        {metrics ? (
          <>
            <p className="t-small t-muted">
              {c.generated(new Date(metrics.generated_at).toLocaleString('en-AU'))}
            </p>
            <div>
              <Button
                variant="outlined"
                onClick={() => downloadText(metricsCsv(metrics), `porto-trial-totals-${metrics.generated_at.slice(0, 10)}.csv`, 'text/csv')}
              >
                {c.csv}
              </Button>
            </div>

            <Card as="section" aria-labelledby="team-funnel">
              <h2 id="team-funnel" className="t-h3">
                {c.funnelHeading}
              </h2>
              <ol className={styles.funnel}>
                {FUNNEL.map((k) => (
                  <li key={k} className={styles.step}>
                    <span className={styles.stepLabel}>{c.funnel[k]}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${(metrics.funnel[k] / max) * 100}%` }} />
                    </span>
                    <span className={styles.stepValue}>{c.families(metrics.funnel[k])}</span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card as="section" aria-labelledby="team-measures">
              <h2 id="team-measures" className="t-h3">
                {c.measuresHeading}
              </h2>
              <dl className={styles.measures}>
                {MEASURES.map((k) => (
                  <div key={k}>
                    <dt>{c.measures[k]}</dt>
                    <dd>{formatMeasure(k, metrics[k])}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card as="section" aria-labelledby="team-families">
              <h2 id="team-families" className="t-h3">
                {c.perFamilyHeading}
              </h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {COLUMNS.map((k) => (
                        <th key={k} scope="col">
                          {c.columns[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.families.map((f) => (
                      <tr key={String(f.family)}>
                        {COLUMNS.map((k, i) =>
                          i === 0 ? (
                            <th key={k} scope="row">
                              {cell(f[k] ?? null)}
                            </th>
                          ) : (
                            <td key={k}>{cell(f[k] ?? null)}</td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
