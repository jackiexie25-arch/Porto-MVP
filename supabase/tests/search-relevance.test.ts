// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { ARI_CUES } from '../../src/demo/ari';
import { admin, as, createFamily, freshDb } from './db';

interface CaseCue {
  label: string;
  cue_type: string;
  category: string;
  aliases: string[];
  description: string;
  meanings: Array<{ context_tags: string[]; context_text: string; meaning: string }>;
}

interface SearchCase {
  profile: 'ari' | 'juno';
  query: string;
  context?: string;
  top: string | null;
  also?: string[];
}

const data = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'search-cases.json'), 'utf8'),
) as { profiles: { juno: CaseCue[] }; cases: SearchCase[] };

let db: PGlite;
const profileIds: Record<SearchCase['profile'], string> = { ari: '', juno: '' };

async function seed(profileId: string, cues: CaseCue[]): Promise<void> {
  await db.query(`delete from public.cues where profile_id = $1`, [profileId]);
  for (const c of cues) {
    const res = await db.query<{ id: string }>(
      `insert into public.cues (profile_id, label, cue_type, category, aliases, description)
       values ($1, $2, $3::public.cue_type, $4::public.cue_category, array(select jsonb_array_elements_text($5::jsonb)), $6)
       returning id`,
      [profileId, c.label, c.cue_type, c.category, JSON.stringify(c.aliases), c.description],
    );
    for (const m of c.meanings) {
      await db.query(
        `insert into public.cue_meanings (cue_id, context_tags, context_text, meaning)
         values ($1, array(select jsonb_array_elements_text($2::jsonb))::public.context_tag[], $3, $4)`,
        [res.rows[0]!.id, JSON.stringify(m.context_tags), m.context_text, m.meaning],
      );
    }
  }
}

beforeAll(async () => {
  db = await freshDb();
  profileIds.ari = (await createFamily(db, 'Ari')).profileId;
  profileIds.juno = (await createFamily(db, 'Juno')).profileId;
  await seed(
    profileIds.ari,
    ARI_CUES.map((c) => ({ ...c, meanings: c.cue_meanings })),
  );
  await seed(profileIds.juno, data.profiles.juno);
});

describe('search_cues relevance (supabase/tests/search-cases.json)', () => {
  it.each(data.cases)('$profile: "$query" → $top', async (c) => {
    const res = await as(db, admin, () =>
      db.query<{ r: Array<{ label: string }> }>(`select public.search_cues($1, $2, $3::public.context_tag) as r`, [
        profileIds[c.profile],
        c.query,
        c.context ?? null,
      ]),
    );
    const labels = res.rows[0]!.r.map((h) => h.label);
    if (c.top === null) {
      expect(labels).toEqual([]);
    } else {
      expect(labels[0]).toBe(c.top);
      expect(labels.filter((l) => l !== c.top && !(c.also ?? []).includes(l))).toEqual([]);
    }
  });
});
