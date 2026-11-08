import type { ContextTag } from '../data/types';
import { config, isSupabaseConfigured } from '../lib/config';
import type { WorkerCardResult, WorkerSearchResult, WorkerSource } from './types';

/**
 * Workers never sign in, so the worker view doesn't load the Supabase client at all: it calls the
 * two worker functions over plain HTTPS with the public anon key. Nothing is stored on the
 * worker's phone, and a family member opening a link is treated exactly like a worker.
 */
async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured) throw new Error('not_configured');
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    throw Object.assign(new Error(`worker_rpc_failed ${response.status}`), { status: response.status });
  }
  return (await response.json()) as T;
}

export function shareSource(token: string): WorkerSource {
  return {
    getCard: () => rpc<WorkerCardResult>('worker_get_card', { p_token: token }),
    search: (query: string, context: ContextTag | null) =>
      rpc<WorkerSearchResult>('worker_search', { p_token: token, p_query: query, p_context: context }),
  };
}
