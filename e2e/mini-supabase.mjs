#!/usr/bin/env node
/**
 * Test-only stand-in for Supabase, used by the Playwright end-to-end tests.
 *
 * It runs Porto's real migrations in PGlite (in-memory Postgres) and answers the subset of
 * Supabase's HTTP API that the app uses: magic-link auth (emails go to a test mailbox instead of
 * being sent), PostgREST-style table reads and writes, and RPC calls. Every request runs as the
 * real `anon` or `authenticated` role, so row-level security and grants behave as in production.
 *
 * Never deploy this. It trusts any well-formed token and has an admin SQL endpoint for tests.
 */
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { ANON_KEY, makeJwt, MINI_SUPABASE_PORT, decodeJwt } from './constants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const db = await PGlite.create({ extensions: { pgcrypto, pg_trgm } });
await db.exec(readFileSync(join(root, 'supabase/tests/supabase-shim.sql'), 'utf8'));
for (const file of readdirSync(join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(root, 'supabase/migrations', file), 'utf8'));
}

// One request at a time: PGlite has a single connection.
let chain = Promise.resolve();
function exclusive(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

function asRole(claims, fn) {
  return exclusive(() =>
    db.transaction(async (tx) => {
      await tx.exec(claims.role === 'authenticated' ? 'set local role authenticated' : 'set local role anon');
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims.sub ?? '']);
      return fn(tx);
    }),
  );
}

const asAdmin = (fn) => exclusive(() => db.transaction(fn));

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

function claimsFrom(req) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers.apikey;
  const payload = token ? decodeJwt(token) : null;
  if (payload?.role === 'authenticated' && payload.sub) return { role: 'authenticated', sub: payload.sub };
  return { role: 'anon' };
}

/** Postgres errors, shaped the way PostgREST reports them. */
function pgError(res, error) {
  const code = error.code ?? '';
  const status = code === '42501' ? 403 : code === '23505' ? 409 : code === 'PGRST116' ? 406 : 400;
  send(res, status, { code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
}

const ident = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw Object.assign(new Error(`bad identifier ${name}`), { code: 'PGRST100' });
  return `"${name}"`;
};

/** A JS value as a Postgres parameter. Arrays become array literals; objects become JSON. */
function param(value) {
  if (Array.isArray(value)) {
    return `{${value.map((v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
  }
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

// ---------------------------------------------------------------------------
// PostgREST subset: select lists with embedding, eq filters, order, limit, single
// ---------------------------------------------------------------------------
const RELATIONS = {
  cues: { cue_meanings: { many: true, table: 'cue_meanings', where: (e) => `${e}.cue_id = t.id` } },
  shift_notes: { shares: { many: false, table: 'shares', where: (e) => `${e}.id = t.share_id` } },
};

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function orderSql(spec, alias) {
  if (!spec) return '';
  const parts = spec.split(',').map((p) => {
    const [col, dir] = p.split('.');
    return `${alias}.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}`;
  });
  return ` order by ${parts.join(', ')}`;
}

function columnsSql(table, select, params) {
  const out = [];
  for (const item of splitTopLevel(select || '*')) {
    const m = item.match(/^(?:([a-z_]+):)?([a-z_]+)\((.*)\)$/);
    if (m) {
      const [, alias, rel, inner] = m;
      const relation = RELATIONS[table]?.[rel];
      if (!relation) throw Object.assign(new Error(`no relation ${table}.${rel}`), { code: 'PGRST200' });
      const innerCols = splitTopLevel(inner)
        .map((c) => (c === '*' ? 'e0.*' : `e0.${ident(c)}`))
        .join(', ');
      const order = orderSql(params.get(`${rel}.order`), 'e0');
      const sub = relation.many
        ? `(select coalesce(json_agg(e), '[]'::json) from (select ${innerCols} from public.${ident(relation.table)} e0 where ${relation.where('e0')}${order}) e)`
        : `(select row_to_json(e) from (select ${innerCols} from public.${ident(relation.table)} e0 where ${relation.where('e0')}) e)`;
      out.push(`${sub} as ${ident(alias ?? rel)}`);
    } else if (item === '*') out.push('t.*');
    else out.push(`t.${ident(item)}`);
  }
  return out.join(', ');
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function filtersSql(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key) || key.includes('.')) continue;
    const [op, ...rest] = raw.split('.');
    const value = rest.join('.');
    if (op === 'eq') {
      values.push(value);
      clauses.push(`t.${ident(key)} = $${values.length}`);
    } else if (op === 'is' && value === 'null') clauses.push(`t.${ident(key)} is null`);
    else throw Object.assign(new Error(`unsupported filter ${key}=${raw}`), { code: 'PGRST100' });
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function wantsSingle(req) {
  return (req.headers.accept ?? '').includes('vnd.pgrst.object+json');
}

function wantsRepresentation(req) {
  return (req.headers.prefer ?? '').includes('return=representation');
}

async function respondRows(req, res, rows, status = 200) {
  if (wantsSingle(req)) {
    if (rows.length !== 1) return pgError(res, { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` });
    return send(res, status, rows[0]);
  }
  return send(res, status, rows);
}

async function handleTable(req, res, table, url) {
  ident(table);
  const params = url.searchParams;
  const claims = claimsFrom(req);
  const select = params.get('select') ?? '*';

  if (req.method === 'GET') {
    const values = [];
    const sql = `select row_to_json(r) as j from (select ${columnsSql(table, select, params)} from public.${ident(table)} t${filtersSql(
      params,
      values,
    )}${orderSql(params.get('order'), 't')}${params.get('limit') ? ` limit ${Number(params.get('limit'))}` : ''}) r`;
    const rows = await asRole(claims, (tx) => tx.query(sql, values));
    return respondRows(req, res, rows.rows.map((r) => r.j));
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const records = Array.isArray(body) ? body : [body];
    const cols = [...new Set(records.flatMap((r) => Object.keys(r)))];
    const values = [];
    const tuples = records.map(
      (r) =>
        `(${cols
          .map((c) => {
            values.push(param(r[c] ?? null));
            return `$${values.length}`;
          })
          .join(', ')})`,
    );
    const conflict = params.get('on_conflict');
    const merge = conflict && (req.headers.prefer ?? '').includes('resolution=merge-duplicates');
    const conflictCols = conflict ? conflict.split(',') : [];
    const onConflict = merge
      ? ` on conflict (${conflictCols.map(ident).join(', ')}) do update set ${cols
          .filter((c) => !conflictCols.includes(c))
          .map((c) => `${ident(c)} = excluded.${ident(c)}`)
          .join(', ')}`
      : '';
    const insert = `insert into public.${ident(table)} (${cols.map(ident).join(', ')}) values ${tuples.join(', ')}${onConflict} returning *`;
    const sql = wantsRepresentation(req)
      ? `with t as (${insert}) select row_to_json(r) as j from (select ${columnsSql(table, select, params)} from t) r`
      : insert;
    const result = await asRole(claims, (tx) => tx.query(sql, values));
    if (!wantsRepresentation(req)) return send(res, 201);
    return respondRows(req, res, result.rows.map((r) => r.j), 201);
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req);
    const values = [];
    const sets = Object.entries(body).map(([c, v]) => {
      values.push(param(v));
      return `${ident(c)} = $${values.length}`;
    });
    const update = `update public.${ident(table)} t set ${sets.join(', ')}${filtersSql(params, values)} returning t.*`;
    const sql = wantsRepresentation(req)
      ? `with t as (${update}) select row_to_json(r) as j from (select ${columnsSql(table, select, params)} from t) r`
      : update;
    const result = await asRole(claims, (tx) => tx.query(sql, values));
    if (!wantsRepresentation(req)) return send(res, 204);
    return respondRows(req, res, result.rows.map((r) => r.j));
  }

  if (req.method === 'DELETE') {
    const values = [];
    await asRole(claims, (tx) => tx.query(`delete from public.${ident(table)} t${filtersSql(params, values)}`, values));
    return send(res, 204);
  }

  return send(res, 405, { message: 'method not allowed' });
}

async function handleRpc(req, res, fn) {
  ident(fn);
  const body = (await readBody(req)) ?? {};
  const values = [];
  const args = Object.entries(body).map(([k, v]) => {
    values.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
    return `${ident(k)} => $${values.length}`;
  });
  const result = await asRole(claimsFrom(req), (tx) => tx.query(`select public.${ident(fn)}(${args.join(', ')}) as r`, values));
  const value = result.rows[0]?.r;
  return send(res, 200, value === undefined || value === '' ? null : value);
}

// ---------------------------------------------------------------------------
// Auth: magic links into a test mailbox, sessions as unsigned JWTs
// ---------------------------------------------------------------------------
const mailbox = new Map();
const refreshTokens = new Map();

async function findUser(where, value) {
  const res = await asAdmin((tx) =>
    tx.query(`select id, email, raw_user_meta_data from auth.users where ${where} = $1`, [value]),
  );
  return res.rows[0] ?? null;
}

function userJson(u) {
  const now = new Date().toISOString();
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: now,
    user_metadata: u.raw_user_meta_data ?? {},
    app_metadata: { provider: 'email', providers: ['email'] },
    identities: [],
    created_at: now,
    updated_at: now,
  };
}

function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomUUID();
  refreshTokens.set(refresh, u.id);
  return {
    access_token: makeJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refresh,
  };
}

async function handleAuth(req, res, path, url) {
  if (path === '/otp' && req.method === 'POST') {
    const body = await readBody(req);
    const email = String(body.email ?? '').toLowerCase();
    let user = await findUser('email', email);
    if (!user) {
      if (body.create_user === false) {
        return send(res, 422, { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' });
      }
      const created = await asAdmin((tx) =>
        tx.query(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id, email, raw_user_meta_data`, [
          email,
          JSON.stringify(body.data ?? {}),
        ]),
      );
      user = created.rows[0];
    }
    const s = session(user);
    const redirect = url.searchParams.get('redirect_to') ?? 'http://127.0.0.1:4173/auth/callback';
    const link = `${redirect}#${new URLSearchParams({ ...s, expires_in: String(s.expires_in), expires_at: String(s.expires_at), type: 'magiclink' })}`;
    mailbox.set(email, [...(mailbox.get(email) ?? []), link]);
    return send(res, 200, {});
  }

  if (path === '/user' && req.method === 'GET') {
    const payload = decodeJwt((req.headers.authorization ?? '').slice(7));
    const user = payload?.sub ? await findUser('id', payload.sub) : null;
    if (!user) return send(res, 403, { code: 403, error_code: 'user_not_found', msg: 'User not found' });
    return send(res, 200, userJson(user));
  }

  if (path === '/token' && req.method === 'POST' && url.searchParams.get('grant_type') === 'refresh_token') {
    const body = await readBody(req);
    const userId = refreshTokens.get(body.refresh_token);
    const user = userId ? await findUser('id', userId) : null;
    if (!user) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    return send(res, 200, { ...session(user), user: userJson(user) });
  }

  if (path === '/logout') return send(res, 204);
  return send(res, 404, { msg: `auth path ${path} not in the test stand-in` });
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------
async function handleTest(req, res, path, url) {
  if (path === '/mailbox') {
    return send(res, 200, { links: mailbox.get(String(url.searchParams.get('email')).toLowerCase()) ?? [] });
  }
  if (path === '/sql' && req.method === 'POST') {
    const { sql, params = [] } = await readBody(req);
    const result = await asAdmin((tx) => tx.query(sql, params));
    return send(res, 200, { rows: result.rows });
  }
  return send(res, 404, {});
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, x-client-info, range, x-supabase-api-version',
  );
  res.setHeader('Access-Control-Expose-Headers', 'content-range');
  if (req.method === 'OPTIONS') return send(res, 204);

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url.pathname.slice(8), url);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return await handleRpc(req, res, url.pathname.slice(13));
    if (url.pathname.startsWith('/rest/v1/')) return await handleTable(req, res, url.pathname.slice(9), url);
    if (url.pathname.startsWith('/__test')) return await handleTest(req, res, url.pathname.slice(7), url);
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    return send(res, 404, { message: 'not found' });
  } catch (error) {
    return pgError(res, error);
  }
});

server.listen(MINI_SUPABASE_PORT, '127.0.0.1', () => {
  console.log(`mini-supabase ready on http://127.0.0.1:${MINI_SUPABASE_PORT} (anon key ${ANON_KEY.slice(0, 12)}…)`);
});
