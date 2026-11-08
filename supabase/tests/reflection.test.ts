// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, as, createFamily, freshDb, user, type Family } from './db';

let db: PGlite;
let a: Family;
let b: Family;

async function share(f: Family, scope = 'card_search_log'): Promise<string> {
  const res = await as(db, user(f.uid), () =>
    db.query<{ r: { token: string } }>(`select public.create_share('Test', '', 8, $1::public.share_scope) as r`, [scope]),
  );
  return res.rows[0]!.r.token;
}

async function call<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T> {
  const res = await as(db, anon, () => db.query<{ r: T }>(sql, params));
  return res.rows[0]!.r;
}

const logNote = (token: string, note: object) =>
  call(`select public.worker_log_note($1, $2) as r`, [token, JSON.stringify(note)]);
const feedback = (token: string, cueId: string, helpful: boolean) =>
  call(`select public.worker_cue_feedback($1, $2, $3) as r`, [token, cueId, helpful]);

async function notes(f: Family) {
  const res = await as(db, user(f.uid), () =>
    db.query<{ id: string; status: string; cue_id: string | null; cue_text: string; context_tags: string[]; seemed_to_need: string; worker_name: string }>(
      `select id, status, cue_id, cue_text, context_tags::text[] as context_tags, seemed_to_need, worker_name
       from public.shift_notes order by created_at desc`,
    ),
  );
  return res.rows;
}

beforeAll(async () => {
  db = await freshDb();
  a = await createFamily(db, 'Ari');
  b = await createFamily(db, 'Bo');
});

describe('worker_get_card cue options', () => {
  it('lists the family’s cue labels only on links that allow notes', async () => {
    const withLog = await call<{ cue_options: Array<{ id: string; label: string }> }>(`select public.worker_get_card($1) as r`, [await share(a)]);
    expect(withLog.cue_options).toEqual([{ id: a.cueId, label: 'Cookie time' }]);
    const searchOnly = await call<{ cue_options: unknown[] }>(`select public.worker_get_card($1) as r`, [await share(a, 'card_search')]);
    expect(searchOnly.cue_options).toEqual([]);
  });
});

describe('worker_log_note', () => {
  it('saves a pending note that only the family can see', async () => {
    const token = await share(a);
    const before = (await notes(a)).length;
    expect(
      await logNote(token, {
        cue_id: a.cueId,
        context_tags: ['school', 'not-a-place'],
        tried: 'Walked to the quiet corner',
        seemed_to_need: 'A break from the noise',
        outcome: 'worked',
        worker_name: 'Jo',
      }),
    ).toEqual({ status: 'ok' });

    const mine = await notes(a);
    expect(mine).toHaveLength(before + 1);
    expect(mine[0]).toMatchObject({ status: 'pending', cue_id: a.cueId, context_tags: ['school'], worker_name: 'Jo' });
    expect((await notes(b)).map((n) => n.id)).not.toContain(mine[0]!.id);
  });

  it('accepts a new description instead of a cue', async () => {
    expect(await logNote(await share(a), { cue_text: 'Spun around three times', outcome: 'partly' })).toEqual({ status: 'ok' });
  });

  it('needs something that happened and whether it helped', async () => {
    const token = await share(a);
    expect(await logNote(token, { outcome: 'worked' })).toEqual({ status: 'invalid' });
    expect(await logNote(token, { cue_text: 'Something', outcome: 'maybe' })).toEqual({ status: 'invalid' });
    expect(await logNote(token, { cue_text: 'Something' })).toEqual({ status: 'invalid' });
  });

  it('refuses another family’s cue', async () => {
    expect(await logNote(await share(a), { cue_id: b.cueId, outcome: 'worked' })).toEqual({ status: 'invalid' });
  });

  it('trims over-long text instead of losing the note', async () => {
    expect(await logNote(await share(a), { cue_text: 'x'.repeat(900), tried: 'y'.repeat(900), outcome: 'no' })).toEqual({ status: 'ok' });
    expect((await notes(a))[0]!.cue_text).toHaveLength(500);
  });

  it('only works on links that allow notes, and never on closed links', async () => {
    expect(await logNote(await share(a, 'card_search'), { cue_text: 'x', outcome: 'worked' })).toEqual({ status: 'not_allowed' });
    expect(await logNote(await share(a, 'card'), { cue_text: 'x', outcome: 'worked' })).toEqual({ status: 'not_allowed' });
    expect(await logNote('B'.repeat(43), { cue_text: 'x', outcome: 'worked' })).toEqual({ status: 'closed' });
  });
});

describe('worker_cue_feedback', () => {
  it('records yes or not really for the family’s own cue', async () => {
    const token = await share(a, 'card_search');
    expect(await feedback(token, a.cueId, true)).toEqual({ status: 'ok' });
    expect(await feedback(token, a.cueId, false)).toEqual({ status: 'ok' });
    expect(await feedback(token, b.cueId, true)).toEqual({ status: 'invalid' });
    expect(await feedback(await share(a, 'card'), a.cueId, true)).toEqual({ status: 'not_allowed' });
  });
});

describe('approve_note', () => {
  it('adds a worker’s note to an existing cue as a new meaning, and search finds it (acceptance 5)', async () => {
    const token = await share(a);
    await logNote(token, { cue_id: a.cueId, context_tags: ['camp'], tried: 'Gave him a water bottle', seemed_to_need: 'A drink after swimming', outcome: 'worked' });
    const note = (await notes(a))[0]!;

    const existing = await as(db, user(a.uid), () =>
      db.query<{ id: string; meaning: string }>(`select id, meaning from public.cue_meanings where cue_id = $1`, [a.cueId]),
    );
    const cue = { id: a.cueId, label: 'Cookie time', cue_type: 'phrase', category: 'food_drink', aliases: [], description: '', pinned: true };
    const meanings = [
      ...existing.rows.map((m) => ({ id: m.id, meaning: m.meaning, context_tags: ['home'] })),
      { context_tags: ['camp'], meaning: 'A drink after swimming', what_to_do: 'Gave him a water bottle', confidence: 'sometimes' },
    ];
    const cueId = await as(db, user(a.uid), () =>
      db.query<{ id: string }>(`select public.approve_note($1, $2, $3) as id`, [note.id, JSON.stringify(cue), JSON.stringify(meanings)]),
    );
    expect(cueId.rows[0]!.id).toBe(a.cueId);

    const after = await as(db, user(a.uid), () =>
      db.query<{ meaning: string; source: string; source_note_id: string | null }>(
        `select meaning, source, source_note_id from public.cue_meanings where cue_id = $1 order by created_at`,
        [a.cueId],
      ),
    );
    expect(after.rows.map((r) => r.source)).toEqual(['family', 'worker_note']);
    expect(after.rows[1]).toMatchObject({ meaning: 'A drink after swimming', source_note_id: note.id });
    expect((await notes(a)).find((n) => n.id === note.id)!.status).toBe('approved');

    const found = await call<{ results: Array<{ label: string; meanings: Array<{ meaning: string; in_context: boolean }> }> }>(
      `select public.worker_search($1, 'swimming', 'camp') as r`,
      [token],
    );
    expect(found.results[0]!.label).toBe('Cookie time');
    expect(found.results[0]!.meanings[0]).toMatchObject({ meaning: 'A drink after swimming', in_context: true });
  });

  it('creates a new cue from a note about something new', async () => {
    await logNote(await share(a), { cue_text: 'Flaps both hands', outcome: 'partly' });
    const note = (await notes(a))[0]!;
    const res = await as(db, user(a.uid), () =>
      db.query<{ id: string }>(`select public.approve_note($1, $2, $3) as id`, [
        note.id,
        JSON.stringify({ label: 'Flaps both hands', cue_type: 'gesture', category: 'connection' }),
        JSON.stringify([{ meaning: 'I’m excited' }]),
      ]),
    );
    const cue = await as(db, user(a.uid), () =>
      db.query<{ label: string; source: string }>(
        `select c.label, m.source from public.cues c join public.cue_meanings m on m.cue_id = c.id where c.id = $1`,
        [res.rows[0]!.id],
      ),
    );
    expect(cue.rows).toEqual([{ label: 'Flaps both hands', source: 'worker_note' }]);
  });

  it('can only be done once, by the family that owns the note', async () => {
    await logNote(await share(a), { cue_text: 'Claps', outcome: 'worked' });
    const note = (await notes(a))[0]!;
    const payload = [note.id, JSON.stringify({ label: 'Claps', cue_type: 'gesture', category: 'other' }), JSON.stringify([{ meaning: 'Yes' }])];
    await expect(
      as(db, user(b.uid), () => db.query(`select public.approve_note($1, $2, $3)`, payload)),
    ).rejects.toThrow(/note_not_found/);
    await expect(as(db, anon, () => db.query(`select public.approve_note($1, $2, $3)`, payload))).rejects.toThrow(/permission denied/);
    await as(db, user(a.uid), () => db.query(`select public.approve_note($1, $2, $3)`, payload));
    await expect(as(db, user(a.uid), () => db.query(`select public.approve_note($1, $2, $3)`, payload))).rejects.toThrow(/note_not_found/);
  });

  it('will not add a note to another family’s cue', async () => {
    await logNote(await share(a), { cue_text: 'Sneaky', outcome: 'worked' });
    const note = (await notes(a))[0]!;
    await expect(
      as(db, user(a.uid), () =>
        db.query(`select public.approve_note($1, $2, $3)`, [
          note.id,
          JSON.stringify({ id: b.cueId, label: 'x', cue_type: 'sound', category: 'other' }),
          JSON.stringify([{ meaning: 'x' }]),
        ]),
      ),
    ).rejects.toThrow(/cue_not_found/);
  });
});

describe('dismiss_note', () => {
  it('sets a note aside, keeps it, and only for its own family', async () => {
    await logNote(await share(a), { cue_text: 'Hums a tune', outcome: 'no' });
    const note = (await notes(a))[0]!;
    const byB = await as(db, user(b.uid), () => db.query<{ ok: boolean }>(`select public.dismiss_note($1) as ok`, [note.id]));
    expect(byB.rows[0]!.ok).toBe(false);
    const byA = await as(db, user(a.uid), () => db.query<{ ok: boolean }>(`select public.dismiss_note($1) as ok`, [note.id]));
    expect(byA.rows[0]!.ok).toBe(true);
    expect((await notes(a)).find((n) => n.id === note.id)!.status).toBe('dismissed');
  });

  it('families still cannot edit notes directly', async () => {
    const note = (await notes(a))[0]!;
    await expect(
      as(db, user(a.uid), () => db.query(`update public.shift_notes set status = 'approved' where id = $1`, [note.id])),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, admin, () => db.query(`select 1`))).resolves.toBeDefined();
  });
});
