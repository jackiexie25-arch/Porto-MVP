// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { addInviteCode, admin, anon, as, createFamily, createUser, freshDb, user, type Family } from './db';

let db: PGlite;
let a: Family;
let b: Family;

async function events(profileId: string | null): Promise<Array<{ name: string; props: Record<string, unknown> }>> {
  const res = await as(db, admin, () =>
    db.query<{ name: string; props: Record<string, unknown> }>(
      profileId
        ? `select name::text as name, props from public.events where profile_id = $1 order by created_at`
        : `select name::text as name, props from public.events where profile_id is null order by created_at`,
      profileId ? [profileId] : [],
    ),
  );
  return res.rows;
}

const names = async (profileId: string | null) => (await events(profileId)).map((e) => e.name);

async function share(f: Family, scope = 'card_search_log', hours = 8): Promise<string> {
  const res = await as(db, user(f.uid), () =>
    db.query<{ r: { token: string } }>(`select public.create_share('x', 'Jo', $1, $2::public.share_scope) as r`, [hours, scope]),
  );
  return res.rows[0]!.r.token;
}

const worker = (sql: string, params: unknown[]) => as(db, anon, () => db.query(sql, params));

beforeAll(async () => {
  db = await freshDb();
  a = await createFamily(db, 'Ari');
  b = await createFamily(db, 'Bo');
});

describe('events recorded by the database', () => {
  it('counts sign-up, consent and the first cue', async () => {
    const list = await names(a.profileId);
    expect(list).toEqual(expect.arrayContaining(['signup_completed', 'cue_created']));
  });

  it('counts a valid invite code as a started sign-up, and a wrong one not at all', async () => {
    const before = (await names(null)).filter((n) => n === 'signup_started').length;
    const code = await addInviteCode(db);
    await worker(`select public.check_invite_code($1)`, [code]);
    await worker(`select public.check_invite_code('NOT-A-CODE')`, []);
    expect((await names(null)).filter((n) => n === 'signup_started').length).toBe(before + 1);
  });

  it('records share_created with scope and hours, and share_opened only on the first open', async () => {
    const token = await share(a, 'card_search', 72);
    await worker(`select public.worker_get_card($1)`, [token]);
    await worker(`select public.worker_get_card($1)`, [token]);
    const list = await events(a.profileId);
    expect(list.filter((e) => e.name === 'share_created').at(-1)!.props).toEqual({ scope: 'card_search', duration_hours: 72 });
    expect(list.filter((e) => e.name === 'share_opened')).toHaveLength(1);
  });

  it('records searches with had_results only, never the query', async () => {
    const token = await share(a);
    await worker(`select public.worker_search($1, 'cookie time')`, [token]);
    await worker(`select public.worker_search($1, 'giraffe trampoline')`, [token]);
    // The test family already has one search from setup; look at the two just made.
    const searches = (await events(a.profileId)).filter((e) => e.name === 'worker_search').slice(-2);
    expect(searches.map((e) => e.props)).toEqual([{ had_results: true }, { had_results: false }]);
    expect(JSON.stringify(searches)).not.toMatch(/cookie|giraffe/);
  });

  it('records feedback, notes, approvals and dismissals', async () => {
    const count = async (name: string) => (await names(a.profileId)).filter((n) => n === name).length;
    const before = {
      feedback: await count('cue_feedback'),
      logged: await count('note_logged'),
      dismissed: await count('note_dismissed'),
      approved: await count('note_approved'),
    };
    const token = await share(a);
    await worker(`select public.worker_cue_feedback($1, $2, true)`, [token, a.cueId]);
    await worker(`select public.worker_log_note($1, $2)`, [token, JSON.stringify({ cue_text: 'Secret words', outcome: 'worked', worker_name: 'Jo' })]);
    await worker(`select public.worker_log_note($1, $2)`, [token, JSON.stringify({ cue_text: 'Other', outcome: 'no' })]);
    const notes = await as(db, user(a.uid), () =>
      db.query<{ id: string }>(`select id from public.shift_notes where status = 'pending' order by created_at desc`),
    );
    await as(db, user(a.uid), () => db.query(`select public.dismiss_note($1)`, [notes.rows[0]!.id]));
    await as(db, user(a.uid), () =>
      db.query(`select public.approve_note($1, $2, $3)`, [
        notes.rows[1]!.id,
        JSON.stringify({ label: 'Secret words', cue_type: 'phrase', category: 'other' }),
        JSON.stringify([{ meaning: 'Something' }]),
      ]),
    );
    const list = await events(a.profileId);
    expect(list.filter((e) => e.name === 'cue_feedback').at(-1)!.props).toEqual({ helpful: true });
    expect(await count('cue_feedback')).toBe(before.feedback + 1);
    expect(await count('note_logged')).toBe(before.logged + 2);
    expect(await count('note_dismissed')).toBe(before.dismissed + 1);
    expect(await count('note_approved')).toBe(before.approved + 1);
    expect(JSON.stringify(list)).not.toMatch(/Secret|Jo/);
  });
});

describe('log_event from the browser', () => {
  const log = (f: Family, name: string, props: object = {}) =>
    as(db, user(f.uid), () => db.query(`select public.log_event($1, $2)`, [name, JSON.stringify(props)]));

  it('accepts only the listed events, and rebuilds props', async () => {
    await log(b, 'onboarding_step_completed', { step: 3, secret: 'nope' });
    await log(b, 'onboarding_step_completed', { step: 9 });
    await log(b, 'card_viewed_by_family', { query: 'cookie' });
    await log(b, 'profile_exported');
    await log(b, 'note_approved'); // only the database records this one
    await log(b, 'made_up_event');
    const browserNames = ['onboarding_step_completed', 'card_viewed_by_family', 'profile_exported', 'note_approved', 'made_up_event'];
    const list = (await events(b.profileId)).filter((e) => browserNames.includes(e.name));
    expect(list).toEqual([
      { name: 'onboarding_step_completed', props: { step: 3 } },
      { name: 'card_viewed_by_family', props: {} },
      { name: 'profile_exported', props: {} },
    ]);
  });

  it('works out onboarding minutes itself, once', async () => {
    await as(db, admin, () =>
      db.query(`update public.profiles set setup_started_at = now() - interval '14 minutes', setup_completed_at = now() where id = $1`, [b.profileId]),
    );
    await log(b, 'onboarding_completed', { minutes: 1 });
    await log(b, 'onboarding_completed');
    const done = (await events(b.profileId)).filter((e) => e.name === 'onboarding_completed');
    expect(done).toEqual([{ name: 'onboarding_completed', props: { minutes: 14 } }]);
  });

  it('is not open to workers', async () => {
    await expect(worker(`select public.log_event('profile_exported', '{}')`, [])).rejects.toThrow(/permission denied/);
  });
});

describe('team_metrics', () => {
  it('is only for team members, and says so calmly to everyone else', async () => {
    const res = await as(db, user(a.uid), () => db.query<{ r: { status: string } }>(`select public.team_metrics() as r`));
    expect(res.rows[0]!.r).toEqual({ status: 'not_team' });
    await expect(worker(`select public.team_metrics()`, [])).rejects.toThrow(/permission denied/);
  });

  it('returns aggregates with anonymous family labels and no free text', async () => {
    const teamUid = await createUser(db);
    const email = await as(db, admin, () => db.query<{ email: string }>(`select email from auth.users where id = $1`, [teamUid]));
    await as(db, admin, () => db.query(`insert into public.team_members (email) values (lower($1))`, [email.rows[0]!.email]));

    const res = await as(db, user(teamUid), () => db.query<{ r: Record<string, unknown> }>(`select public.team_metrics() as r`));
    const m = res.rows[0]!.r as {
      status: string;
      funnel: Record<string, number>;
      median_onboarding_minutes: number | null;
      families: Array<Record<string, unknown>>;
      zero_result_rate: number;
      helped_rate: number;
      approval_rate: number;
    };
    expect(m.status).toBe('ok');
    expect(m.funnel).toMatchObject({ signed_up: 2, completed_onboarding: 1, created_share: 2 });
    expect(Number(m.funnel.worker_searched)).toBeGreaterThanOrEqual(1);
    expect(Number(m.median_onboarding_minutes)).toBe(14);
    expect(Number(m.zero_result_rate)).toBeGreaterThan(0);
    expect(Number(m.helped_rate)).toBe(1);
    expect(Number(m.approval_rate)).toBe(0.5);
    expect(m.families.map((f) => f.family)).toEqual(['Family 01', 'Family 02']);

    const text = JSON.stringify(m);
    for (const secret of ['Ari', 'Bo', 'Cookie time', 'cookie', 'giraffe', 'Secret words', 'Jo', '@example.test', a.profileId, a.uid]) {
      expect(text, secret).not.toContain(secret);
    }
  });
});

describe('delete_my_account', () => {
  it('needs the child’s name typed to confirm', async () => {
    const c = await createFamily(db, 'Cy');
    await expect(as(db, user(c.uid), () => db.query(`select public.delete_my_account('wrong')`))).rejects.toThrow(/confirm_mismatch/);
    await expect(as(db, user(c.uid), () => db.query(`select public.delete_my_account('')`))).rejects.toThrow(/confirm_mismatch/);
  });

  it('deletes the profile, everything in it, consent and the account, and closes every link', async () => {
    const c = await createFamily(db, 'Cy');
    const token = await share(c);
    await worker(`select public.worker_log_note($1, $2)`, [token, JSON.stringify({ cue_text: 'x', outcome: 'worked' })]);
    const deletedBefore = (await names(null)).filter((n) => n === 'profile_deleted').length;

    await as(db, user(c.uid), () => db.query(`select public.delete_my_account(' cy ')`));

    const left = await as(db, admin, () =>
      db.query<{ n: number }>(
        `select
          (select count(*) from auth.users where id = $1) +
          (select count(*) from public.consents where user_id = $1) +
          (select count(*) from public.profiles where id = $2) +
          (select count(*) from public.cues where profile_id = $2) +
          (select count(*) from public.card_sections where profile_id = $2) +
          (select count(*) from public.shares where profile_id = $2) +
          (select count(*) from public.shift_notes where profile_id = $2) +
          (select count(*) from public.search_log where profile_id = $2) +
          (select count(*) from public.events where profile_id = $2) as n`,
        [c.uid, c.profileId],
      ),
    );
    expect(Number(left.rows[0]!.n)).toBe(0);

    const card = await as(db, anon, () => db.query<{ r: unknown }>(`select public.worker_get_card($1) as r`, [token]));
    expect(card.rows[0]!.r).toEqual({ status: 'closed' });
    expect((await names(null)).filter((n) => n === 'profile_deleted').length).toBe(deletedBefore + 1);
  });

  it('accepts DELETE when the child has no name yet, and leaves other families alone', async () => {
    const d = await createFamily(db, '');
    await as(db, user(d.uid), () => db.query(`select public.delete_my_account('delete')`));
    const bStill = await as(db, user(b.uid), () => db.query(`select 1 from public.profiles`));
    expect(bStill.rows).toHaveLength(1);
  });

  it('is not open to workers', async () => {
    await expect(worker(`select public.delete_my_account('x')`, [])).rejects.toThrow(/permission denied/);
  });
});
