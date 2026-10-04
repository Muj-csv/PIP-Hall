// Connect GitHub as a second identity (D-003, ADR-003). The handle shown on cards is copied
// server-side from auth.identities by sync_github_identity(), never typed into a form.

import { callbackUrl } from './authService';
import { requireSupabase } from './supabase';

export const githubService = {
  /** Full-page redirect to GitHub; requires "manual linking" enabled in Supabase Auth. */
  async connect(next = '/edit'): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.auth.linkIdentity({ provider: 'github', options: { redirectTo: callbackUrl(next) } });
    if (error) throw error;
  },

  /** Copies the verified handle onto the caller's profile (if it exists) and returns it. */
  async sync(): Promise<string | null> {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc('sync_github_identity');
    if (error) throw error;
    return typeof data === 'string' && data ? data : null;
  },
};
