/** Public build-time settings. Only the anon key ever reaches the browser. */
const env = import.meta.env;

export const config = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  privacyContactEmail: (env.VITE_PRIVACY_CONTACT_EMAIL as string | undefined) ?? '',
};

/** HTTPS in production; plain http only for a stand-in on this computer (end-to-end tests). */
const urlOk = /^https:\/\//.test(config.supabaseUrl) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(config.supabaseUrl);

export const isSupabaseConfigured =
  urlOk &&
  !config.supabaseUrl.includes('PROJECT_REF') &&
  config.supabaseAnonKey.length > 20;
