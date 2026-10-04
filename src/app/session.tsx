// Session provider (Phase 2): follows Supabase auth state and loads the user's own role row.
// The role only shapes the UI; every write is still checked by the database (RLS + is_admin()).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService, toAuthUser } from '../services/authService';
import { SessionContext, type SessionState } from './sessionContext';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(() =>
    authService.isConfigured ? { status: 'loading' } : { status: 'unavailable' },
  );

  const apply = useCallback(async (s: Session | null) => {
    if (!s) {
      setSession({ status: 'signed-out' });
      return;
    }
    const user = toAuthUser(s.user);
    setSession((prev) => ({ status: 'signed-in', user, role: prev.status === 'signed-in' && prev.user.id === user.id ? prev.role : null }));
    try {
      const role = await authService.getMyRole(user.id);
      setSession((prev) => (prev.status === 'signed-in' && prev.user.id === user.id ? { ...prev, role } : prev));
    } catch {
      // Role lookup failed: treat as member. The database refuses admin calls anyway.
      setSession((prev) => (prev.status === 'signed-in' && prev.user.id === user.id ? { ...prev, role: 'member' } : prev));
    }
  }, []);

  useEffect(() => {
    if (!authService.isConfigured) return;
    let live = true;
    authService
      .getSession()
      .then((s) => {
        if (live) void apply(s);
      })
      .catch(() => {
        if (live) setSession({ status: 'signed-out' });
      });
    // onAuthStateChange callbacks must not await Supabase calls directly; defer the role lookup.
    const off = authService.onChange((s) => {
      window.setTimeout(() => live && void apply(s), 0);
    });
    return () => {
      live = false;
      off();
    };
  }, [apply]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(authService.isConfigured ? { status: 'signed-out' } : { status: 'unavailable' });
  }, []);

  const refresh = useCallback(async () => {
    await apply(await authService.getSession());
  }, [apply]);

  const value = useMemo(() => ({ session, signOut, refresh }), [session, signOut, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
