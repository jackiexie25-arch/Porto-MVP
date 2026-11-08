/** Public build-time settings. Only the anon key ever reaches the browser. */
const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  privacyContactEmail: (env.VITE_PRIVACY_CONTACT_EMAIL as string | undefined) ?? '',
};

export const isSupabaseConfigured =
  config.supabaseUrl.startsWith('https://') &&
  !config.supabaseUrl.includes('PROJECT_REF') &&
  config.supabaseAnonKey.length > 20;
