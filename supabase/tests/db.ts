import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

/** A fresh Postgres with the Supabase shim and every migration applied, in order, from scratch. */
export async function freshDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm } });
  await db.exec(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'));
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  return db;
}

export type Who = { role: 'admin' } | { role: 'anon' } | { role: 'user'; id: string };

export const admin: Who = { role: 'admin' };
export const anon: Who = { role: 'anon' };
export const user = (id: string): Who => ({ role: 'user', id });

/** Runs `fn` as the given caller, then always returns to the admin (superuser) session. */
export async function as<T>(db: PGlite, who: Who, fn: () => Promise<T>): Promise<T> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who.role === 'user' ? who.id : '']);
  if (who.role === 'anon') await db.exec('set role anon');
  if (who.role === 'user') await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

let counter = 0;

export async function createUser(db: PGlite, meta: Record<string, unknown> = {}): Promise<string> {
  counter += 1;
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`family${counter}-${Date.now()}@example.test`, JSON.stringify(meta)],
  );
  return res.rows[0]!.id;
}

export async function addInviteCode(db: PGlite, code?: string): Promise<string> {
  counter += 1;
  const value = code ?? `TESTCODE${counter}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  await db.query(`insert into public.invite_codes (code) values ($1)`, [value]);
  return value;
}

export async function giveConsent(db: PGlite, uid: string): Promise<void> {
  await as(db, user(uid), () =>
    db.query(`insert into public.consents (user_id, version) values (auth.uid(), public.consent_version())`),
  );
}

export interface Family {
  uid: string;
  profileId: string;
  cueId: string;
  meaningId: string;
  shareId: string;
  noteId: string;
}

/** A signed-up family with one of every family-owned row, created the way the app creates them. */
export async function createFamily(db: PGlite, name = 'Ari'): Promise<Family> {
  const uid = await createUser(db);
  const code = await addInviteCode(db);
  await giveConsent(db, uid);
  const profileId = await as(db, user(uid), async () => {
    const res = await db.query<{ id: string }>(`select public.create_profile($1) as id`, [code]);
    await db.query(`update public.profiles set display_name = $1 where id = $2`, [name, res.rows[0]!.id]);
    return res.rows[0]!.id;
  });

  const { cueId, meaningId } = await as(db, user(uid), async () => {
    await db.query(
      `insert into public.card_sections (profile_id, section, body) values ($1, 'toileting', 'Taps the door twice.')`,
      [profileId],
    );
    const cue = await db.query<{ id: string }>(
      `insert into public.cues (profile_id, label, cue_type, category) values ($1, 'Cookie time', 'phrase', 'food_drink') returning id`,
      [profileId],
    );
    const meaning = await db.query<{ id: string }>(
      `insert into public.cue_meanings (cue_id, context_tags, meaning, what_to_do) values ($1, '{home,mealtime}', 'I''m hungry', 'Offer a snack') returning id`,
      [cue.rows[0]!.id],
    );
    return { cueId: cue.rows[0]!.id, meaningId: meaning.rows[0]!.id };
  });

  // Rows that only RPCs (or workers) create are inserted directly as admin here.
  const share = await db.query<{ id: string }>(
    `insert into public.shares (profile_id, label, token_hash, expires_at)
     values ($1, 'Camp weekend', extensions.digest(gen_random_uuid()::text, 'sha256'), now() + interval '8 hours') returning id`,
    [profileId],
  );
  const shareId = share.rows[0]!.id;
  const note = await db.query<{ id: string }>(
    `insert into public.shift_notes (profile_id, share_id, cue_id, cue_text, tried, outcome)
     values ($1, $2, $3, 'Said cookie time', 'Offered a snack', 'worked') returning id`,
    [profileId, shareId, cueId],
  );
  await db.query(
    `insert into public.search_log (profile_id, share_id, query, context_tag, result_count) values ($1, $2, 'cookie', 'home', 1)`,
    [profileId, shareId],
  );
  await db.query(`insert into public.cue_feedback (cue_id, share_id, helpful) values ($1, $2, true)`, [cueId, shareId]);
  await db.query(`insert into public.events (name, profile_id) values ('cue_created', $1)`, [profileId]);

  return { uid, profileId, cueId, meaningId, shareId, noteId: note.rows[0]!.id };
}
