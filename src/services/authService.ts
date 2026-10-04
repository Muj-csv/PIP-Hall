// Google sign-in, sign-out and session state (FR-01, ADR-003). Components use this through
// the SessionProvider; they never touch the Supabase client.

import type { Session, User } from '@supabase/supabase-js';
import { NotConfiguredError, isSupabaseConfigured, requireSupabase, supabase } from './supabase';

export type AppRole = 'member' | 'admin';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  /** GitHub handle from a linked GitHub identity, if any (verified by GitHub). */
  githubHandle: string | null;
}

export function toAuthUser(user: User): AuthUser {
  const github = user.identities?.find((i) => i.provider === 'github');
  const gd = (github?.identity_data ?? {}) as Record<string, unknown>;
  const md = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    id: user.id,
    email: user.email ?? null,
    name: str(md.full_name) ?? str(md.name),
    githubHandle: str(gd.user_name) ?? str(gd.preferred_username),
  };
}

export function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

export const authService = {
  isConfigured: isSupabaseConfigured,

  async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /** Subscribes to sign-in / sign-out / refresh. Returns an unsubscribe function. */
  onChange(cb: (session: Session | null) => void): () => void {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },

  /** Full-page redirect to Google; comes back to /auth/callback. Only openid email profile. */
  async signInWithGoogle(next: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(next), scopes: 'openid email profile' },
    });
    if (error) throw error;
  },

  /** Ends the session everywhere; if the server can't be reached, at least clears this device. */
  async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      const local = await supabase.auth.signOut({ scope: 'local' });
      if (local.error) throw local.error;
    }
  },

  /** The caller's own role row. The database enforces admin rights; this only shapes the UI. */
  async getMyRole(userId: string): Promise<AppRole> {
    const sb = requireSupabase();
    const { data, error } = await sb.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data?.role === 'admin' ? 'admin' : 'member';
  },
};

export { NotConfiguredError };
