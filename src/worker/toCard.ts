import { copy } from '../copy/en-AU';
import type { Cue, Profile } from '../data/types';
import { buildCard, type CardModel } from '../lib/card';
import type { WorkerCardData } from './types';

/** Builds the same card model the family previews, from what the share link returned. */
export function workerCard(data: WorkerCardData): CardModel {
  const profile: Profile = {
    ...data.profile,
    id: 'shared',
    setup_step: 6,
    setup_started_at: null,
    setup_completed_at: null,
  };
  const cues: Cue[] = data.cues.map((c) => ({
    ...c,
    cue_type: 'other',
    category: 'other',
    description: '',
    aliases: [],
    cue_meanings: c.cue_meanings.map((m, i) => ({
      ...m,
      id: `${c.id}-${i}`,
      cue_id: c.id,
      source: 'family',
      created_at: c.created_at,
    })),
  }));
  return buildCard(profile, data.sections, cues, copy.worker.theirChild);
}
