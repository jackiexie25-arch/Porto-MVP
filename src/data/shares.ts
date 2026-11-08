import type { ShareRow } from '../lib/share';
import { getSupabase } from '../lib/supabase';

export async function listShares(): Promise<ShareRow[]> {
  const { data, error } = await getSupabase()
    .from('shares')
    .select('id, label, worker_name, scope, expires_at, revoked_at, first_opened_at, last_opened_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ShareRow[];
}

export interface CreatedShare {
  id: string;
  token: string;
  expires_at: string;
}

/** The token comes back once, here. It is never stored or shown again. */
export async function createShare(input: {
  label: string;
  workerName: string;
  hours: number;
  scope: ShareRow['scope'];
}): Promise<CreatedShare> {
  const { data, error } = await getSupabase().rpc('create_share', {
    p_label: input.label,
    p_worker_name: input.workerName,
    p_hours: input.hours,
    p_scope: input.scope,
  });
  if (error) throw error;
  return data as CreatedShare;
}

export async function revokeShare(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_share', { p_share_id: id });
  if (error) throw error;
}
