// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createFamily, freshDb, user, type Family } from './db';

let db: PGlite;
let a: Family;

beforeAll(async () => {
  db = await freshDb();
  a = await createFamily(db, 'Ari');
});

async function upsertSection(section: string, details: object, body = '') {
  return as(db, user(a.uid), () =>
    db.query(
      `insert into public.card_sections (profile_id, section, details, body) values ($1, $2, $3, $4)
       on conflict (profile_id, section) do update set details = excluded.details, body = excluded.body`,
      [a.profileId, section, JSON.stringify(details), body],
    ),
  );
}

describe('card section details', () => {
  it('stores each prompt answer separately and upserts', async () => {
    await upsertSection('toileting', { signs: 'Taps the door twice', what_to_do: 'Take him straight away' });
    await upsertSection('toileting', { signs: 'Taps the door twice', avoid: 'Asking if he needs to go' });
    const res = await as(db, user(a.uid), () =>
      db.query<{ details: Record<string, string> }>(
        `select details from public.card_sections where profile_id = $1 and section = 'toileting'`,
        [a.profileId],
      ),
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.details).toEqual({ signs: 'Taps the door twice', avoid: 'Asking if he needs to go' });
  });

  it('rejects keys that do not belong to the section', async () => {
    await expect(upsertSection('toileting', { triggers: 'Noise' })).rejects.toThrow(/card_sections_details_ok/);
    await expect(upsertSection('calms', { anything: 'x' })).rejects.toThrow(/card_sections_details_ok/);
  });

  it('rejects non-string or over-long answers', async () => {
    await expect(upsertSection('food_drink', { signs: 42 })).rejects.toThrow(/card_sections_details_ok/);
    await expect(upsertSection('food_drink', { signs: 'x'.repeat(501) })).rejects.toThrow(/card_sections_details_ok/);
  });

  it('keeps calms and avoid as plain body text', async () => {
    await expect(upsertSection('calms', {}, 'Quiet room, weighted blanket')).resolves.toBeDefined();
  });
});

describe('setup progress', () => {
  it('lets the family record where they are up to', async () => {
    const res = await as(db, user(a.uid), () =>
      db.query(
        `update public.profiles set setup_step = 3, setup_started_at = now() where id = $1`,
        [a.profileId],
      ),
    );
    expect(res.affectedRows).toBe(1);
  });

  it('only allows steps 1 to 6', async () => {
    await expect(
      as(db, user(a.uid), () => db.query(`update public.profiles set setup_step = 7 where id = $1`, [a.profileId])),
    ).rejects.toThrow(/check constraint/);
  });
});
