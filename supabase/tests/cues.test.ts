// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { admin, as, createFamily, freshDb, user, type Family } from './db';

const cases = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'normalise-cases.json'), 'utf8'),
) as Array<[string, string]>;

let db: PGlite;
let a: Family;
let b: Family;

interface MeaningIn {
  id?: string;
  context_tags?: string[];
  context_text?: string;
  meaning: string;
  what_to_do?: string;
  what_to_avoid?: string;
  confidence?: string;
}

async function saveCue(f: Family, cue: Record<string, unknown>, meanings: MeaningIn[]): Promise<string> {
  const res = await as(db, user(f.uid), () =>
    db.query<{ id: string }>(`select public.save_cue($1, $2, $3) as id`, [
      f.profileId,
      JSON.stringify(cue),
      JSON.stringify(meanings),
    ]),
  );
  return res.rows[0]!.id;
}

interface Hit {
  id: string;
  label: string;
  match: string;
  meanings: Array<{ meaning: string; context_tags: string[]; in_context: boolean }>;
}

async function search(f: Family, query: string, context: string | null = null): Promise<Hit[]> {
  const res = await as(db, admin, () =>
    db.query<{ r: Hit[] }>(`select public.search_cues($1, $2, $3::public.context_tag) as r`, [
      f.profileId,
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
  // createFamily adds "Cookie time" with one meaning; replace it with the demo-style version.
  await as(db, admin, () => db.query(`delete from public.cues where profile_id = $1`, [a.profileId]));

  await saveCue(a, { label: 'Cookie time', cue_type: 'phrase', category: 'food_drink', aliases: ['cookie', 'cookies'] }, [
    { context_tags: ['home', 'mealtime'], meaning: 'I’m hungry', what_to_do: 'Offer a snack' },
    { context_tags: ['school'], meaning: 'I need a break', what_to_do: 'Quiet corner for five minutes' },
  ]);
  await saveCue(a, { label: 'Taps the bathroom door twice', cue_type: 'behaviour', category: 'toileting', aliases: ['door', 'knocks'] }, [
    { meaning: 'I need the toilet', what_to_do: 'Take him straight away', confidence: 'always' },
  ]);
  await saveCue(a, { label: 'Blue bottle', cue_type: 'phrase', category: 'food_drink', aliases: ['water', 'drink'] }, [
    { meaning: 'I’m thirsty', what_to_do: 'Give him his water bottle' },
  ]);
  await saveCue(a, { label: 'Hands over ears and humming', cue_type: 'behaviour', category: 'overstimulation', description: 'Often at assembly' }, [
    { context_tags: ['school'], meaning: 'It’s too loud', what_to_do: 'Lower the noise' },
  ]);
  await saveCue(a, { label: 'Rocking faster than usual', cue_type: 'behaviour', category: 'overstimulation' }, [
    { meaning: 'Things are getting too much', what_to_do: 'Move somewhere quieter' },
  ]);
  await saveCue(b, { label: 'Cookie monster', cue_type: 'phrase', category: 'other' }, [{ meaning: 'Family B only' }]);
});

describe('normalise_query', () => {
  it.each(cases)('normalises %j to %j', async (input, expected) => {
    const res = await db.query<{ n: string }>(`select public.normalise_query($1) as n`, [input]);
    expect(res.rows[0]!.n).toBe(expected);
  });
});

describe('search_cues ranking', () => {
  it('puts an exact label match first, ignoring case and punctuation', async () => {
    const hits = await search(a, 'Cookie time!');
    expect(hits[0]).toMatchObject({ label: 'Cookie time', match: 'label' });
  });

  it('finds a cue by one of its aliases', async () => {
    const hits = await search(a, 'knocks');
    expect(hits[0]).toMatchObject({ label: 'Taps the bathroom door twice', match: 'alias' });
  });

  it('finds near-misses and part phrases by similarity', async () => {
    expect((await search(a, 'cokie tme'))[0]?.label).toBe('Cookie time');
    expect((await search(a, 'bathroom door'))[0]?.label).toBe('Taps the bathroom door twice');
  });

  it('falls back to the meaning and description text', async () => {
    const hits = await search(a, 'thirsty');
    expect(hits.map((h) => h.label)).toContain('Blue bottle');
    expect(hits.find((h) => h.label === 'Blue bottle')!.match).toBe('meaning');
    expect((await search(a, 'assembly'))[0]?.label).toBe('Hands over ears and humming');
  });

  it('returns nothing rather than a guess when nothing matches', async () => {
    expect(await search(a, 'giraffe trampoline')).toEqual([]);
    expect(await search(a, '   ')).toEqual([]);
    expect(await search(a, '?!')).toEqual([]);
  });

  it('returns at most 5 cues', async () => {
    const hits = await search(a, 'e');
    expect(hits.length).toBeLessThanOrEqual(5);
  });

  it('only ever searches the given family’s cues', async () => {
    const hits = await search(a, 'cookie monster');
    expect(hits.map((h) => h.label)).not.toContain('Cookie monster');
    expect((await search(b, 'cookie'))[0]?.label).toBe('Cookie monster');
  });
});

describe('search_cues context', () => {
  it('lists the meaning for the selected place first', async () => {
    const atSchool = (await search(a, 'cookie time', 'school'))[0]!;
    expect(atSchool.meanings.map((m) => m.meaning)).toEqual(['I need a break', 'I’m hungry']);
    expect(atSchool.meanings[0]!.in_context).toBe(true);

    const atHome = (await search(a, 'cookie time', 'home'))[0]!;
    expect(atHome.meanings.map((m) => m.meaning)).toEqual(['I’m hungry', 'I need a break']);
  });

  it('boosts cues with a meaning for the selected place among equally good matches', async () => {
    // Two cues that match "twirl" equally well (both by alias); only one has a school meaning.
    await saveCue(a, { label: 'A spin at home', cue_type: 'behaviour', category: 'other', aliases: ['twirl'] }, [
      { context_tags: ['home'], meaning: 'I’m happy' },
    ]);
    await saveCue(a, { label: 'B spin at school', cue_type: 'behaviour', category: 'other', aliases: ['twirl'] }, [
      { context_tags: ['school'], meaning: 'I need to move' },
    ]);
    const top2 = async (context: string | null) => (await search(a, 'twirl', context)).slice(0, 2).map((h) => h.label);
    expect(await top2(null)).toEqual(['A spin at home', 'B spin at school']);
    expect(await top2('school')).toEqual(['B spin at school', 'A spin at home']);
  });

  it('never lets the place outrank a better match', async () => {
    // "Cookie time" (exact) has a school meaning too, but an exact match still wins at home.
    const atHome = await search(a, 'cookie time', 'camp');
    expect(atHome[0]?.label).toBe('Cookie time');
  });
});

describe('search_cues access', () => {
  it('cannot be called by workers or families directly', async () => {
    await expect(
      as(db, user(a.uid), () => db.query(`select public.search_cues($1, 'cookie')`, [a.profileId])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('save_cue', () => {
  it('creates a cue with several meanings in one step', async () => {
    const id = await saveCue(a, { label: 'Shoes', cue_type: 'behaviour', category: 'other' }, [
      { context_tags: ['home'], meaning: 'I want to go outside' },
      { context_text: 'with Grandma', context_tags: ['other'], meaning: 'Time to go home' },
    ]);
    const rows = await as(db, user(a.uid), () =>
      db.query<{ meaning: string }>(`select meaning from public.cue_meanings where cue_id = $1 order by created_at`, [id]),
    );
    expect(rows.rows.map((r) => r.meaning)).toEqual(['I want to go outside', 'Time to go home']);
  });

  it('updates, adds and removes meanings to match what was saved', async () => {
    const id = await saveCue(a, { label: 'Wave', cue_type: 'gesture', category: 'connection' }, [
      { meaning: 'Hello' },
      { meaning: 'Goodbye' },
    ]);
    const before = await as(db, user(a.uid), () =>
      db.query<{ id: string; meaning: string }>(`select id, meaning from public.cue_meanings where cue_id = $1 order by created_at`, [id]),
    );
    const hello = before.rows[0]!;
    await saveCue(a, { id, label: 'Flat-hand wave', cue_type: 'gesture', category: 'connection' }, [
      { id: hello.id, meaning: 'All done' },
      { meaning: 'Stop' },
    ]);
    const after = await as(db, user(a.uid), () =>
      db.query<{ id: string; meaning: string }>(`select id, meaning from public.cue_meanings where cue_id = $1 order by created_at`, [id]),
    );
    expect(after.rows.map((r) => r.meaning)).toEqual(['All done', 'Stop']);
    expect(after.rows[0]!.id).toBe(hello.id);
  });

  it('needs at least one meaning, and saves nothing otherwise', async () => {
    await expect(saveCue(a, { label: 'Lonely', cue_type: 'sound', category: 'other' }, [])).rejects.toThrow(/meaning_required/);
    const res = await as(db, user(a.uid), () => db.query(`select 1 from public.cues where label = 'Lonely'`));
    expect(res.rows).toHaveLength(0);
  });

  it('rolls back the cue if a meaning is invalid', async () => {
    await expect(
      saveCue(a, { label: 'Half saved', cue_type: 'sound', category: 'other' }, [{ meaning: '' }]),
    ).rejects.toThrow();
    const res = await as(db, user(a.uid), () => db.query(`select 1 from public.cues where label = 'Half saved'`));
    expect(res.rows).toHaveLength(0);
  });

  it('gives pins the first free place and stops at 5', async () => {
    const pinned: string[] = [];
    for (let i = 1; i <= 5; i += 1) {
      pinned.push(await saveCue(a, { label: `Pin ${i}`, cue_type: 'sound', category: 'other', pinned: true }, [{ meaning: 'x' }]));
    }
    await expect(
      saveCue(a, { label: 'Pin 6', cue_type: 'sound', category: 'other', pinned: true }, [{ meaning: 'x' }]),
    ).rejects.toThrow(/pin_limit/);

    // Unpin number 2, and the next pin takes place 2.
    await saveCue(a, { id: pinned[1], label: 'Pin 2', cue_type: 'sound', category: 'other', pinned: false }, [{ meaning: 'x' }]);
    const id = await saveCue(a, { label: 'Pin 7', cue_type: 'sound', category: 'other', pinned: true }, [{ meaning: 'x' }]);
    const res = await as(db, user(a.uid), () =>
      db.query<{ pin_order: number }>(`select pin_order from public.cues where id = $1`, [id]),
    );
    expect(res.rows[0]!.pin_order).toBe(2);
  });

  it('cannot touch another family’s cue', async () => {
    const theirs = await saveCue(b, { label: 'Private', cue_type: 'sound', category: 'other' }, [{ meaning: 'B only' }]);
    await expect(
      saveCue(a, { id: theirs, label: 'Hacked', cue_type: 'sound', category: 'other' }, [{ meaning: 'x' }]),
    ).rejects.toThrow(/cue_not_found/);
    await expect(
      as(db, user(a.uid), () =>
        db.query(`select public.save_cue($1, $2, $3)`, [
          b.profileId,
          JSON.stringify({ label: 'Planted', cue_type: 'sound', category: 'other' }),
          JSON.stringify([{ meaning: 'x' }]),
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
