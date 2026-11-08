import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './config';

let client: SupabaseClient | null = null;

/**
 * The single Supabase client. Magic links use the implicit flow so a family can ask for a link
 * on a laptop and open it on their phone (PKCE links only work in the browser that asked).
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('not_configured');
  client ??= createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
