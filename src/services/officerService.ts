// The officers' space (V2-10b, D-123): who the officers are (public), and Admin → Affiliations'
// officer tools. The database checks is_admin() and every field. Without a database there are no
// officers: nobody is invented (rule 7).

import { parseOfficers, type Officer } from '../lib/officers';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';
const notYet = (e: { code?: string; message?: string }) => e.code === 'PGRST202' || /hall_officers/.test(e.message ?? '');

export const officerService = {
  /** Every member of the hall on an officers' team, current terms first. */
  async hall(): Promise<Officer[]> {
    if (!useSupabase) return [];
    const { data, error } = await requireSupabase().rpc('hall_officers');
    if (error) {
      if (notYet(error)) return [];
      throw error;
    }
    return parseOfficers(data);
  },

  /** Makes an affiliation an officers' team for a term (or a plain one again). */
  async setTeam(key: string, officers: boolean, termEnds: string | null): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_set_officers', { p_key: key, p_officers: officers, p_term_ends: termEnds });
    if (error) throw error;
  },

  /** Names a member an officer of a team, or changes their position and seat. */
  async setOfficer(memberId: string, key: string, position: string, seat: number): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_set_officer', { p_member: memberId, p_key: key, p_position: position, p_seat: seat });
    if (error) throw error;
  },
};

export function officerErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/BAD_POSITION/.test(msg)) return 'A position is 2 to 40 characters.';
  if (/BAD_SEAT/.test(msg)) return 'The order is a number from 1 to 100.';
  if (/NOT_IN_HALL/.test(msg)) return 'Only members with a card in the hall can be officers.';
  if (/NOT_OFFICERS/.test(msg)) return 'Make it an officers’ team first.';
  if (/NO_SUCH_AFFILIATION/.test(msg)) return 'That affiliation is gone. Reload.';
  if (/NOT_ADMIN/.test(msg)) return 'Only admins can name officers.';
  if (/admin_set_officer/.test(msg)) return 'The hall’s database needs the officers update first. See the deploy guide.';
  return 'That didn’t work. Try again.';
}
