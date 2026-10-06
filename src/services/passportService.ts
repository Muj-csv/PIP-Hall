// The Passport (V2-2, D-097, D-098). Guests keep it on their device; approved members keep it in
// their account (the database records discoveries and exhibit visits; nothing here can grant PIPs).

import { parsePassport, type PassportData } from '../lib/passport';
import { requireSupabase } from './supabase';

const KEY = 'piphall-passport-v1';

export const passportService = {
  /** This device's Passport. Storage may be blocked (private mode): then it starts empty each visit. */
  device: {
    load(): PassportData {
      try {
        return parsePassport(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
      } catch {
        return parsePassport(null);
      }
    },
    save(data: PassportData): void {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        // full or blocked storage: the Passport still works for this visit
      }
    },
  },

  /** The signed-in member's own Passport. `eligible` = their card is in the hall. */
  async mine(): Promise<{ eligible: boolean; data: PassportData }> {
    const { data, error } = await requireSupabase().rpc('my_passport');
    if (error) throw error;
    const r = data as { eligible: boolean; people: unknown; exhibits: unknown };
    return { eligible: Boolean(r.eligible), data: parsePassport({ people: r.people, exhibits: r.exhibits }) };
  },

  /** The member opened an exhibit's page. Stamps it once; never pays PIPs. */
  async stampExhibit(projectId: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('stamp_exhibit', { p_project: projectId });
    if (error) throw error;
    return Boolean(data);
  },

  /** Brings a device Passport into the account as history: no PIPs, no achievements (D-097). */
  async importDevice(d: PassportData): Promise<{ people: number; exhibits: number }> {
    const pick = (list: PassportData['people']) => list.map(({ id, at }) => ({ id, at }));
    const { data, error } = await requireSupabase().rpc('import_passport', { p_people: pick(d.people), p_exhibits: pick(d.exhibits) });
    if (error) throw error;
    return data as { people: number; exhibits: number };
  },
};
