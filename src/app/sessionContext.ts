import { createContext, useContext } from 'react';
import type { AppRole, AuthUser } from '../services/authService';

export type SessionState =
  | { status: 'unavailable' } // Supabase env not set (fixture-only build)
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser; role: AppRole | null };

export interface SessionValue {
  session: SessionState;
  signOut: () => Promise<void>;
  /** Re-reads the user (e.g. after connecting GitHub). */
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
