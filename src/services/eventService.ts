// Hackathons and building events (V2-9, D-115 to D-117): the Museum's event rooms and Winners'
// Hall, the ribbons members won, submitting a project, and Admin → Events → Results. The database
// checks every rule (windows, ownership, tracks, one award per place) and keeps the results private
// until they are announced. Without a database there are no events: none are invented (rule 7).

import { curatedEvents, type Award, type HallAward, type MuseumEvent } from '../lib/events';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';
/** Before the hackathons update the functions don't exist: no events rather than an error. */
const notYet = (e: { code?: string; message?: string }, fn: string) => e.code === 'PGRST202' || new RegExp(fn).test(e.message ?? '');

export interface AdminEntry {
  project_id: string;
  title: string | null;
  username: string;
  full_name: string;
  track: string | null;
  submitted_at: string;
  /** Still on the maker's approved card (only those can be shown, and win). */
  on_card: boolean;
}

export interface AdminResults {
  announced_at: string | null;
  entries: AdminEntry[];
  awards: (Award & { id: number; note: string })[];
}

export const eventService = {
  /** Every hackathon and building event that has begun, newest first, with its results and, as the
   *  Museum shows them (D-130), only the entries that won. */
  async museumEvents(): Promise<MuseumEvent[]> {
    if (!useSupabase) return [];
    const { data, error } = await requireSupabase().rpc('museum_events');
    if (error) {
      if (notYet(error, 'museum_events')) return [];
      throw error;
    }
    return curatedEvents((data ?? []) as MuseumEvent[]);
  },

  /** Ribbons by member id (announced awards only). */
  async hallAwards(): Promise<Map<string, HallAward[]>> {
    if (!useSupabase) return new Map();
    const { data, error } = await requireSupabase().rpc('hall_awards');
    if (error) {
      if (notYet(error, 'hall_awards')) return new Map();
      throw error;
    }
    return new Map(((data ?? []) as { profile_id: string; awards: HallAward[] }[]).map((r) => [r.profile_id, r.awards ?? []]));
  },

  /** Submits one of my projects (or moves it to another track). */
  async submit(key: string, projectId: string, track: string | null): Promise<void> {
    const { error } = await requireSupabase().rpc('submit_to_event', { p_key: key, p_project: projectId, p_track: track });
    if (error) throw error;
  },

  async withdraw(key: string): Promise<void> {
    const { error } = await requireSupabase().rpc('withdraw_from_event', { p_key: key });
    if (error) throw error;
  },

  // ---- Admin → Events → Results. The database checks is_admin() and every rule.
  async results(key: string): Promise<AdminResults> {
    const { data, error } = await requireSupabase().rpc('admin_event_results', { p_key: key });
    if (error) throw error;
    return data as AdminResults;
  },

  async saveAward(key: string, a: { projectId: string; place: number | null; name: string | null; track: string | null; note: string }): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_save_award', {
      p_key: key,
      p_project: a.projectId,
      p_place: a.place,
      p_name: a.name,
      p_track: a.track,
      p_note: a.note,
    });
    if (error) throw error;
  },

  async awardNote(id: number, note: string): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_award_note', { p_id: id, p_note: note });
    if (error) throw error;
  },

  async removeAward(id: number): Promise<void> {
    const { error } = await requireSupabase().rpc('admin_delete_award', { p_id: id });
    if (error) throw error;
  },

  async announce(key: string): Promise<{ makers: number }> {
    const { data, error } = await requireSupabase().rpc('admin_announce_results', { p_key: key });
    if (error) throw error;
    return data as { makers: number };
  },
};

export function eventErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/SUBMISSIONS_CLOSED/.test(msg)) return 'Submissions aren’t open right now.';
  if (/ONE_PER_EVENT/.test(msg)) return 'One project per member per event. Withdraw your entry first to submit another.';
  if (/NOT_LIVE/.test(msg)) return 'Only projects on your approved card can be entered.';
  if (/BAD_TRACK/.test(msg)) return 'Pick one of the event’s tracks.';
  if (/NOT_SUBMITTED/.test(msg)) return 'That project wasn’t entered in this event.';
  if (/NOT_ELIGIBLE/.test(msg)) return 'Entering events opens once your card is approved.';
  if (/STILL_OPEN/.test(msg)) return 'Awards can be recorded once submissions close.';
  if (/ALREADY_ANNOUNCED/.test(msg)) return 'The results are announced. Only judges’ notes can be corrected now.';
  if (/AWARD_TAKEN/.test(msg)) return 'That award already has a winner (and a project takes one place per track).';
  if (/BAD_AWARD/.test(msg)) return 'Pick 1st, 2nd or 3rd place, or name the award (2 to 40 characters).';
  if (/BAD_NOTE/.test(msg)) return 'Keep the judges’ note to 200 characters.';
  if (/NO_AWARDS/.test(msg)) return 'Record at least one award before announcing.';
  if (/NO_SUCH_EVENT/.test(msg)) return 'That event doesn’t take submissions.';
  if (/NOT_ADMIN/.test(msg)) return 'Only admins can record results.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return 'That didn’t work. Try again.';
}
