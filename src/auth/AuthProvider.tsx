import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CONSENT_VERSION } from '../lib/consent';
import { isSupabaseConfigured } from '../lib/config';
import type { FamilyStatus } from '../lib/family';
import { getSupabase } from '../lib/supabase';

interface AuthState {
  /** True until the first session check and family status load have finished. */
  loading: boolean;
  session: Session | null;
  status: FamilyStatus;
  /** The child's display name once the profile has one. */
  displayName: string;
  refresh: () => Promise<FamilyStatus>;
  signOut: () => Promise<void>;
}

const signedOut: FamilyStatus = { signedIn: false, consented: false, profileId: null };

const AuthContext = createContext<AuthState | null>(null);

async function loadStatus(session: Session | null): Promise<{ status: FamilyStatus; displayName: string }> {
  if (!session) return { status: signedOut, displayName: '' };
  const supabase = getSupabase();
  const [consent, profile] = await Promise.all([
    supabase.from('consents').select('id').eq('version', CONSENT_VERSION).limit(1),
    supabase.from('profiles').select('id, display_name').limit(1),
  ]);
  if (consent.error) throw consent.error;
  if (profile.error) throw profile.error;
  const row = profile.data[0] as { id: string; display_name: string } | undefined;
  return {
    status: { signedIn: true, consented: consent.data.length > 0, profileId: row?.id ?? null },
    displayName: row?.display_name ?? '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<FamilyStatus>(signedOut);
  const [displayName, setDisplayName] = useState('');

  const apply = useCallback(async (next: Session | null) => {
    setSession(next);
    try {
      const loaded = await loadStatus(next);
      setStatus(loaded.status);
      setDisplayName(loaded.displayName);
      return loaded.status;
    } catch {
      // Keep the session; pages show a calm retry message if their own requests fail.
      const fallback = { ...signedOut, signedIn: next !== null };
      setStatus(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void apply(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Token refreshes don't change who is signed in, so don't reload status for them.
      if (active && (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED')) {
        void apply(next);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [apply]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return signedOut;
    const { data } = await getSupabase().auth.getSession();
    return apply(data.session);
  }, [apply]);

  const signOut = useCallback(async () => {
    try {
      // 'local' clears this browser even if the account no longer exists on the server.
      if (isSupabaseConfigured) await getSupabase().auth.signOut({ scope: 'local' });
    } finally {
      setSession(null);
      setStatus(signedOut);
      setDisplayName('');
    }
  }, []);

  const value = useMemo(
    () => ({ loading, session, status, displayName, refresh, signOut }),
    [loading, session, status, displayName, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
