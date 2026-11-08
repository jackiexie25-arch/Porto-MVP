// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from '../../src/lib/consent';
import { addInviteCode, admin, anon, as, createUser, freshDb, giveConsent, user } from './db';

let db: PGlite;

beforeAll(async () => {
  db = await freshDb();
});

async function createProfile(uid: string, code: string) {
  return as(db, user(uid), () => db.query<{ id: string }>(`select public.create_profile($1) as id`, [code]));
}

async function isValid(code: string) {
  const res = await as(db, anon, () => db.query<{ ok: boolean }>(`select public.check_invite_code($1) as ok`, [code]));
  return res.rows[0]!.ok;
}

describe('consent version', () => {
  it('matches the version the app asks families to accept', async () => {
    const res = await db.query<{ v: string }>(`select public.consent_version() as v`);
    expect(res.rows[0]!.v).toBe(CONSENT_VERSION);
  });
});

describe('create_profile', () => {
  it('requires consent first', async () => {
    const uid = await createUser(db);
    const code = await addInviteCode(db);
    await expect(createProfile(uid, code)).rejects.toThrow(/consent_required/);
    expect(await isValid(code)).toBe(true);
  });

  it('rejects a code that does not exist', async () => {
    const uid = await createUser(db);
    await giveConsent(db, uid);
    await expect(createProfile(uid, 'NOT-A-REAL-CODE')).rejects.toThrow(/invalid_invite_code/);
  });

  it('creates the profile and marks the code used by this family', async () => {
    const uid = await createUser(db);
    const code = await addInviteCode(db);
    await giveConsent(db, uid);
    const res = await createProfile(uid, code);
    expect(res.rows[0]!.id).toMatch(/[0-9a-f-]{36}/);

    const used = await as(db, admin, () =>
      db.query<{ used_by: string; used_at: string | null }>(`select used_by, used_at from public.invite_codes where code = $1`, [code]),
    );
    expect(used.rows[0]!.used_by).toBe(uid);
    expect(used.rows[0]!.used_at).not.toBeNull();
    expect(await isValid(code)).toBe(false);
  });

  it('never lets a code be used twice', async () => {
    const code = await addInviteCode(db);
    const first = await createUser(db);
    const second = await createUser(db);
    await giveConsent(db, first);
    await giveConsent(db, second);
    await createProfile(first, code);
    await expect(createProfile(second, code)).rejects.toThrow(/invalid_invite_code/);
  });

  it('returns the existing profile when called again, without needing a code', async () => {
    const uid = await createUser(db);
    const code = await addInviteCode(db);
    await giveConsent(db, uid);
    const first = await createProfile(uid, code);
    const again = await createProfile(uid, '');
    expect(again.rows[0]!.id).toBe(first.rows[0]!.id);
  });

  it('accepts codes typed in lowercase or with spaces', async () => {
    const uid = await createUser(db);
    await addInviteCode(db, 'PORTOAB12CD34');
    await giveConsent(db, uid);
    expect(await isValid(' porto ab12 cd34 ')).toBe(true);
    await expect(createProfile(uid, 'porto ab12 cd34')).resolves.toBeDefined();
  });
});
