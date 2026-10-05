// Settings (FR-16): email preferences and deleting the account. Deleting removes the member's
// images first (Storage rows don't cascade from auth.users), then the account itself through
// delete_my_account(), which cascades to the draft, its projects and the public card.

import type { ImageBucket } from './storageService';
import { requireSupabase } from './supabase';

const BUCKETS: ImageBucket[] = ['avatars', 'project-covers'];
const PAGE = 1000;

export interface Preferences {
  email_updates: boolean;
  show_email: boolean;
}

export const accountService = {
  /** Saves the two email choices. Changing show_email changes the public card, so it goes back to review. */
  async savePreferences(userId: string, prefs: Preferences): Promise<void> {
    const { error } = await requireSupabase().from('profiles').update(prefs).eq('id', userId);
    if (error) throw error;
  },

  /** Removes every image in the member's own folders. Returns how many files were removed. */
  async deleteMyImages(userId: string): Promise<number> {
    const storage = requireSupabase().storage;
    let removed = 0;
    for (const bucket of BUCKETS) {
      for (;;) {
        const { data, error } = await storage.from(bucket).list(userId, { limit: PAGE });
        if (error) throw error;
        const paths = (data ?? []).filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`);
        if (!paths.length) break;
        const { error: rmError } = await storage.from(bucket).remove(paths);
        if (rmError) throw rmError;
        removed += paths.length;
        if (paths.length < PAGE) break;
      }
    }
    return removed;
  },

  /** Deletes images, then the account. The caller signs out afterwards. */
  async deleteAccount(userId: string): Promise<void> {
    await this.deleteMyImages(userId);
    const { error } = await requireSupabase().rpc('delete_my_account');
    if (error) throw error;
  },
};
