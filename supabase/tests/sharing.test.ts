// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, as, createFamily, freshDb, user, type Family } from './db';

let db: PGlite;
let a: Family;
let b: Family;

interface Created {
  id: string;
  token: string;
  expires_at: string;
}

async function createShare(f: Family, scope = 'card_search_log', hours = 8, label = 'Camp weekend'): Promise<Created> {
  const res = await as(db, user(f.uid), () =>
    db.query<{ r: Created }>(`select public.create_share($1, 'Jo', $2, $3::public.share_scope) as r`, [label, hours, scope]),
  );
  return res.rows[0]!.r;
}

async function getCard(token: string): Promise<Record<string, unknown>> {
  const res = await as(db, anon, () => db.query<{ r: Record<string, unknown> }>(`select public.worker_get_card($1) as r`, [token]));
  return res.rows[0]!.r;
}

async function workerSearch(token: string, query: string, context: string | null = null): Promise<Record<string, unknown>> {
  const res = await as(db, anon, () =>
    db.query<{ r: Record<string, unknown> }>(`select public.worker_search($1, $2, $3::public.context_tag) as r`, [
      token,
      query,
      context,
    ]),
  );
  return res.rows[0]!.r;
}

beforeAll(async () => {
  db = await freshDb();
  a = await createFamily(db, 'Ari');
  b = await createFamily(db, 'Bo');
  // Pin family A's cue so it appears on the card.
  await as(db, admin, () => db.query(`update public.cues set pinned = true, pin_order = 1 where id = $1`, [a.cueId]));
});

describe('create_share', () => {
  it('returns a high-entropy token once and stores only its hash', async () => {
    const s = await createShare(a);
    expect(s.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await as(db, admin, () =>
      db.query<{ matches: boolean; anywhere: boolean }>(
        `select token_hash = extensions.digest($2, 'sha256') as matches,
                position($2 in row_to_json(s)::text) > 0 as anywhere
         from public.shares s where id = $1`,
        [s.id, s.token],
      ),
    );
    expect(row.rows[0]).toEqual({ matches: true, anywhere: false });
  });

  it('makes a different token every time', async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 10; i += 1) tokens.add((await createShare(a)).token);
    expect(tokens.size).toBe(10);
  });

  it('caps links at 14 days', async () => {
    const s = await createShare(a, 'card', 336);
    expect(new Date(s.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(14 * 24 * 3600 * 1000);
    await expect(createShare(a, 'card', 337)).rejects.toThrow(/invalid_duration/);
    await expect(createShare(a, 'card', 0)).rejects.toThrow(/invalid_duration/);
  });

  it('can only be used by a signed-in family, for their own profile', async () => {
    await expect(
      as(db, anon, () => db.query(`select public.create_share('x', '', 8, 'card')`)),
    ).rejects.toThrow(/permission denied/);
    const s = await createShare(b);
    const card = await getCard(s.token);
    expect((card.profile as { display_name: string }).display_name).toBe('Bo');
  });
});

describe('worker_get_card', () => {
  it('shows the card for a valid link, and only card data', async () => {
    const s = await createShare(a);
    const card = await getCard(s.token);
    expect(card.status).toBe('ok');
    expect(card.scope).toBe('card_search_log');
    expect(card).not.toHaveProperty('profile_id');
    const profile = card.profile as Record<string, unknown>;
    expect(profile.display_name).toBe('Ari');
    expect(profile).not.toHaveProperty('id');
    expect(profile).not.toHaveProperty('owner_id');
    expect(JSON.stringify(card)).not.toContain(a.uid);
    expect(JSON.stringify(card)).not.toContain(a.profileId);
    const cues = card.cues as Array<{ label: string }>;
    expect(cues.map((c) => c.label)).toEqual(['Cookie time']);
  });

  it('records when the link was first and last opened', async () => {
    const s = await createShare(a);
    await getCard(s.token);
    await getCard(s.token);
    const row = await as(db, admin, () =>
      db.query<{ first: string | null; last: string | null }>(
        `select first_opened_at as first, last_opened_at as last from public.shares where id = $1`,
        [s.id],
      ),
    );
    expect(row.rows[0]!.first).not.toBeNull();
    expect(row.rows[0]!.last).not.toBeNull();
  });

  it('gives the same calm "closed" answer for wrong, expired and closed links, with no data', async () => {
    const expired = await createShare(a);
    await as(db, admin, () =>
      db.query(`update public.shares set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1`, [expired.id]),
    );
    const closed = await createShare(a);
    await as(db, user(a.uid), () => db.query(`select public.revoke_share($1)`, [closed.id]));

    const answers = [
      await getCard('A'.repeat(43)),
      await getCard('not-a-token'),
      await getCard(''),
      await getCard(expired.token),
      await getCard(closed.token),
    ];
    for (const answer of answers) expect(answer).toEqual({ status: 'closed' });
  });

  it('closes every link when the profile is deleted', async () => {
    const c = await createFamily(db, 'Cy');
    const s = await createShare(c);
    expect((await getCard(s.token)).status).toBe('ok');
    await as(db, user(c.uid), () => db.query(`delete from public.profiles where id = $1`, [c.profileId]));
    expect(await getCard(s.token)).toEqual({ status: 'closed' });
  });

  it('slows down after 60 calls a minute on one link', async () => {
    const s = await createShare(a);
    for (let i = 0; i < 60; i += 1) expect((await getCard(s.token)).status).toBe('ok');
    expect(await getCard(s.token)).toEqual({ status: 'busy' });
    expect(await workerSearch(s.token, 'cookie')).toEqual({ status: 'busy' });

    // A new minute starts the count again.
    await as(db, admin, () =>
      db.query(`update public.shares set rate_window_start = now() - interval '61 seconds' where id = $1`, [s.id]),
    );
    expect((await getCard(s.token)).status).toBe('ok');

    // Other links are not affected.
    const other = await createShare(a);
    expect((await getCard(other.token)).status).toBe('ok');
  });
});

describe('revoke_share', () => {
  it('closes a link straight away', async () => {
    const s = await createShare(a);
    expect((await getCard(s.token)).status).toBe('ok');
    const res = await as(db, user(a.uid), () => db.query<{ ok: boolean }>(`select public.revoke_share($1) as ok`, [s.id]));
    expect(res.rows[0]!.ok).toBe(true);
    expect(await getCard(s.token)).toEqual({ status: 'closed' });
    expect(await workerSearch(s.token, 'cookie')).toEqual({ status: 'closed' });
  });

  it('cannot close another family’s link', async () => {
    const s = await createShare(b);
    const res = await as(db, user(a.uid), () => db.query<{ ok: boolean }>(`select public.revoke_share($1) as ok`, [s.id]));
    expect(res.rows[0]!.ok).toBe(false);
    expect((await getCard(s.token)).status).toBe('ok');
  });
});

describe('worker_search', () => {
  it('searches the shared profile and logs the search for the family only', async () => {
    const s = await createShare(a);
    const res = await workerSearch(s.token, 'Cookie time!', 'home');
    expect(res.status).toBe('ok');
    expect((res.results as Array<{ label: string }>)[0]!.label).toBe('Cookie time');

    const log = await as(db, user(a.uid), () =>
      db.query<{ query: string; context_tag: string; result_count: number }>(
        `select query, context_tag, result_count from public.search_log where share_id = $1`,
        [s.id],
      ),
    );
    expect(log.rows).toEqual([{ query: 'Cookie time!', context_tag: 'home', result_count: 1 }]);
    const seenByB = await as(db, user(b.uid), () => db.query(`select 1 from public.search_log where share_id = $1`, [s.id]));
    expect(seenByB.rows).toHaveLength(0);
  });

  it('never returns another family’s cues', async () => {
    // Both test families have a "Cookie time" cue; B's link must only ever find B's.
    const s = await createShare(b);
    const ids = ((await workerSearch(s.token, 'cookie time')).results as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual([b.cueId]);
    expect(ids).not.toContain(a.cueId);
  });

  it('returns nothing, not a guess, when nothing matches', async () => {
    const s = await createShare(a);
    expect(await workerSearch(s.token, 'giraffe trampoline')).toEqual({ status: 'ok', results: [] });
  });

  it('respects a card-only link', async () => {
    const s = await createShare(a, 'card');
    expect((await getCard(s.token)).status).toBe('ok');
    expect(await workerSearch(s.token, 'cookie')).toEqual({ status: 'not_allowed' });
  });

  it('does not log empty searches', async () => {
    const s = await createShare(a);
    await workerSearch(s.token, '  ?! ');
    const log = await as(db, admin, () => db.query(`select 1 from public.search_log where share_id = $1`, [s.id]));
    expect(log.rows).toHaveLength(0);
  });
});

describe('anon still has no direct table access', () => {
  it('cannot read shares, even with a token', async () => {
    await expect(as(db, anon, () => db.query(`select * from public.shares`))).rejects.toThrow(/permission denied/);
  });

  it('cannot call the internal helpers', async () => {
    await expect(as(db, anon, () => db.query(`select * from public.use_share('x')`))).rejects.toThrow(/permission denied/);
    await expect(
      as(db, anon, () => db.query(`select public.search_cues($1, 'cookie')`, [a.profileId])),
    ).rejects.toThrow(/permission denied/);
  });
});
