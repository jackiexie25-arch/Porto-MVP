// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, as, createFamily, freshDb, user, type Family } from './db';

let db: PGlite;
let a: Family;
let b: Family;

beforeAll(async () => {
  db = await freshDb();
  a = await createFamily(db, 'Ari');
  b = await createFamily(db, 'Bo');
});

async function publicTables(): Promise<string[]> {
  const res = await db.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );
  return res.rows.map((r) => r.tablename);
}

describe('anon', () => {
  it('cannot read any table directly', async () => {
    const tables = await publicTables();
    expect(tables.length).toBeGreaterThanOrEqual(12);
    for (const table of tables) {
      await expect(as(db, anon, () => db.query(`select * from public.${table}`)), table).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it('cannot write to any table directly', async () => {
    await expect(
      as(db, anon, () => db.query(`insert into public.invite_codes (code) values ('SNEAKY123')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, anon, () => db.query(`delete from public.profiles`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('cannot create a profile', async () => {
    await expect(as(db, anon, () => db.query(`select public.create_profile('ANYCODE1')`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('family isolation', () => {
  const ownedTables: Array<[string, (f: Family) => string, string]> = [
    ['profiles', (f) => f.profileId, 'id'],
    ['card_sections', (f) => f.profileId, 'profile_id'],
    ['cues', (f) => f.cueId, 'id'],
    ['cue_meanings', (f) => f.meaningId, 'id'],
    ['shares', (f) => f.shareId, 'id'],
    ['shift_notes', (f) => f.noteId, 'id'],
    ['search_log', (f) => f.profileId, 'profile_id'],
    ['cue_feedback', (f) => f.cueId, 'cue_id'],
    ['consents', (f) => f.uid, 'user_id'],
  ];

  it('each family reads its own rows', async () => {
    for (const [table, key, column] of ownedTables) {
      const res = await as(db, user(a.uid), () =>
        db.query(`select 1 from public.${table} where ${column} = $1`, [key(a)]),
      );
      expect(res.rows.length, table).toBeGreaterThan(0);
    }
  });

  it('family B cannot read any of family A’s rows', async () => {
    for (const [table, key, column] of ownedTables) {
      const res = await as(db, user(b.uid), () =>
        db.query(`select 1 from public.${table} where ${column} = $1`, [key(a)]),
      );
      expect(res.rows, table).toHaveLength(0);
    }
  });

  it('family B cannot update or delete family A’s rows', async () => {
    await as(db, user(b.uid), async () => {
      const r1 = await db.query(`update public.profiles set display_name = 'Hacked' where id = $1`, [a.profileId]);
      const r2 = await db.query(`update public.cues set label = 'Hacked' where id = $1`, [a.cueId]);
      const r3 = await db.query(`update public.cue_meanings set meaning = 'Hacked' where id = $1`, [a.meaningId]);
      const r4 = await db.query(`update public.card_sections set body = 'Hacked' where profile_id = $1`, [a.profileId]);
      const r5 = await db.query(`delete from public.cues where id = $1`, [a.cueId]);
      const r6 = await db.query(`delete from public.profiles where id = $1`, [a.profileId]);
      for (const r of [r1, r2, r3, r4, r5, r6]) expect(r.affectedRows).toBe(0);
    });

    const check = await as(db, admin, () =>
      db.query<{ display_name: string; label: string }>(
        `select p.display_name, c.label from public.profiles p join public.cues c on c.profile_id = p.id where c.id = $1`,
        [a.cueId],
      ),
    );
    expect(check.rows[0]).toEqual({ display_name: 'Ari', label: 'Cookie time' });
  });

  it('family B cannot add rows under family A’s profile or cues', async () => {
    await expect(
      as(db, user(b.uid), () =>
        db.query(
          `insert into public.cues (profile_id, label, cue_type, category) values ($1, 'Planted', 'sound', 'other')`,
          [a.profileId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      as(db, user(b.uid), () =>
        db.query(`insert into public.cue_meanings (cue_id, meaning) values ($1, 'Planted')`, [a.cueId]),
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      as(db, user(b.uid), () =>
        db.query(`insert into public.card_sections (profile_id, section, body) values ($1, 'calms', 'x')`, [
          a.profileId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('family B cannot move its own cue into family A’s profile', async () => {
    await expect(
      as(db, user(b.uid), () => db.query(`update public.cues set profile_id = $1 where id = $2`, [a.profileId, b.cueId])),
    ).rejects.toThrow(/row-level security/);
  });

  it('a family cannot consent on someone else’s behalf', async () => {
    await expect(
      as(db, user(b.uid), () =>
        db.query(`insert into public.consents (user_id, version) values ($1, 'x')`, [a.uid]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('family limits', () => {
  it('cannot change who owns a profile', async () => {
    await expect(
      as(db, user(a.uid), () => db.query(`update public.profiles set owner_id = $1 where id = $2`, [b.uid, a.profileId])),
    ).rejects.toThrow(/permission denied/);
  });

  it('cannot create profiles, shares or notes directly', async () => {
    await expect(
      as(db, user(a.uid), () => db.query(`insert into public.profiles (owner_id) values (auth.uid())`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(a.uid), () =>
        db.query(
          `insert into public.shares (profile_id, label, token_hash, expires_at) values ($1, 'x', '\\x00', now() + interval '1 hour')`,
          [a.profileId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(a.uid), () => db.query(`update public.shares set revoked_at = null where id = $1`, [a.shareId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(a.uid), () =>
        db.query(`insert into public.shift_notes (profile_id, outcome) values ($1, 'worked')`, [a.profileId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('cannot read invite codes, events or team members', async () => {
    for (const table of ['invite_codes', 'events', 'team_members']) {
      await expect(as(db, user(a.uid), () => db.query(`select * from public.${table}`)), table).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it('can pin at most 5 cues', async () => {
    await as(db, user(a.uid), async () => {
      for (let i = 1; i <= 5; i += 1) {
        await db.query(
          `insert into public.cues (profile_id, label, cue_type, category, pinned, pin_order) values ($1, $2, 'sound', 'other', true, $3)`,
          [a.profileId, `Pinned ${i}`, i],
        );
      }
    });
    await expect(
      as(db, user(a.uid), () =>
        db.query(`update public.cues set pinned = true where id = $1`, [a.cueId]),
      ),
    ).rejects.toThrow(/pin_limit/);
  });
});

describe('deleting a profile', () => {
  it('removes every linked row and every share link', async () => {
    const c = await createFamily(db, 'Cy');
    const deleted = await as(db, user(c.uid), () =>
      db.query(`delete from public.profiles where id = $1`, [c.profileId]),
    );
    expect(deleted.affectedRows).toBe(1);

    const leftovers = await as(db, admin, () =>
      db.query<{ n: number }>(
        `select
           (select count(*) from public.card_sections where profile_id = $1) +
           (select count(*) from public.cues where profile_id = $1) +
           (select count(*) from public.cue_meanings where cue_id = $2) +
           (select count(*) from public.shares where profile_id = $1) +
           (select count(*) from public.shift_notes where profile_id = $1) +
           (select count(*) from public.search_log where profile_id = $1) +
           (select count(*) from public.cue_feedback where cue_id = $2) +
           (select count(*) from public.events where profile_id = $1) as n`,
        [c.profileId, c.cueId],
      ),
    );
    expect(Number(leftovers.rows[0]!.n)).toBe(0);
  });
});
