// Missions (V2-3, D-099). Members claim them in the database, which checks the condition and pays
// (complete_mission); guests keep the ones they finish on this device, for the stamp only.

import type { Mission } from '../lib/missions';
import { requireSupabase } from './supabase';

const KEY = 'piphall-missions-v1';

export interface MyMissions {
  eligible: boolean;
  /** The database's own day and week labels, so everyone shares one calendar. */
  day: string;
  week: string;
  done: string[];
}

export const missionService = {
  device: {
    /** Keys of Missions finished on this device. */
    load(): string[] {
      try {
        const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
        return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string').slice(-500) : [];
      } catch {
        return [];
      }
    },
    save(keys: string[]): void {
      try {
        localStorage.setItem(KEY, JSON.stringify(keys.slice(-500)));
      } catch {
        // blocked storage: the Mission still shows as done for this visit
      }
    },
  },

  async mine(): Promise<MyMissions> {
    const { data, error } = await requireSupabase().rpc('my_missions');
    if (error) throw error;
    const r = data as { eligible: boolean; day: string; week: string; done: { key: string }[] };
    return { eligible: Boolean(r.eligible), day: r.day, week: r.week, done: (r.done ?? []).map((d) => d.key) };
  },

  async complete(m: Mission): Promise<{ key: string; amount: number; balance: number }> {
    const { data, error } = await requireSupabase().rpc('complete_mission', { p_scope: m.scope, p_kind: m.kind, p_param: m.param, p_n: m.n });
    if (error) throw error;
    return data as { key: string; amount: number; balance: number };
  },
};

export function missionErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/NOT_DONE/.test(msg)) return 'Pip hasn’t seen that yet. Open their profile (or the exhibit) first, then claim.';
  if (/MISSION_LIMIT/.test(msg)) return 'You’ve claimed every Mission for now. New ones come at midnight (Manila time).';
  if (/ALREADY_DONE/.test(msg)) return 'Already claimed.';
  if (/NOT_ELIGIBLE/.test(msg)) return 'Missions pay PIPs once your card is approved.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return 'That didn’t work. Try again.';
}
