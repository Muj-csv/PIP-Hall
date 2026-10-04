// The one Supabase client. Only modules in src/services/ may import this file (CLAUDE.md).
// Only public values reach the browser: the project URL and the anon key (NFR-05).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

/** Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        flowType: 'pkce', // OAuth returns ?code= to /auth/callback; the client exchanges it
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase is not set up yet: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    this.name = 'NotConfiguredError';
  }
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}
