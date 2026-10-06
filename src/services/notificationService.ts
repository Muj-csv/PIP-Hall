// Notifications and "Recent in the hall" (V2-4, D-100). The database decides what each member may
// read (my_notifications: events addressed to them) and what is public (recent_hall_events).

import type { HallNotification, MyNotifications, RecentEvent } from '../lib/notifications';
import { requireSupabase } from './supabase';

export const notificationService = {
  async mine(): Promise<MyNotifications> {
    const { data, error } = await requireSupabase().rpc('my_notifications');
    if (error) throw error;
    const r = (data ?? {}) as { seen_at?: string | null; items?: HallNotification[] };
    return { seenAt: r.seen_at ?? null, items: r.items ?? [] };
  },

  /** Marks everything up to now as seen; returns the new marker. */
  async markSeen(): Promise<string> {
    const { data, error } = await requireSupabase().rpc('mark_notifications_seen');
    if (error) throw error;
    return data as string;
  },

  async recent(limit = 8): Promise<RecentEvent[]> {
    const { data, error } = await requireSupabase().rpc('recent_hall_events', { p_limit: limit });
    if (error) throw error;
    return (data ?? []) as RecentEvent[];
  },
};
