// Seasons and events (V2-7, D-103). The database decides what is live and checks the event's
// Mission before paying; admins schedule events through checked functions. Hackathons and building
// events (V2-9, D-115) add a kind, tracks and a schedule; their entries and results live in
// eventService.

import type { EventKind } from '../lib/events';
import { NO_SEASON, type CurrentSeason, type Season } from '../lib/seasons';
import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export interface AdminSeason extends Season {
  state: 'live' | 'upcoming' | 'over';
  /** How many submissions and awards it has (hackathons and building events). */
  entries?: number;
  award_count?: number;
}

export interface SeasonInput {
  key: string;
  name: string;
  blurb: string;
  startsOn: string;
  endsOn: string;
  mission: { kind: string; param: string | null; n: number; reward: number } | null;
  frame: string | null;
  kind: EventKind;
  tracks: string[];
  /** ISO instants; only for hackathons and building events. */
  submissionsClose: string | null;
  resultsAt: string | null;
}

/** What the signed-in member has to do with the live event. */
export interface MySeason {
  eligible: boolean;
  done: boolean;
  submission: { project_id: string; track: string | null } | null;
}

// The banner and the hall panel both ask; one request a minute is plenty.
let cached: { at: number; value: Promise<CurrentSeason> } | null = null;
const notYet = (e: { code?: string; message?: string }, fn: string) => e.code === 'PGRST202' || new RegExp(fn).test(e.message ?? '');

export const seasonService = {
  /** The live event and the next one. None without a database or before the events update. */
  current(): Promise<CurrentSeason> {
    if (!useSupabase) return Promise.resolve(NO_SEASON);
    if (cached && Date.now() - cached.at < 60_000) return cached.value;
    const value = (async () => {
      const { data, error } = await requireSupabase().rpc('current_season');
      if (error) {
        if (notYet(error, 'current_season')) return NO_SEASON;
        throw error;
      }
      const r = (data ?? {}) as Partial<CurrentSeason>;
      return { live: r.live ?? null, next: r.next ?? null, results: r.results ?? null };
    })();
    cached = { at: Date.now(), value };
    value.catch(() => (cached = null));
    return value;
  },

  /** Forget the cached event (after a submission changes its counts). */
  refresh(): void {
    cached = null;
  },

  /** For a member: whether they've done the live event's Mission, and what they submitted to it. */
  async mine(): Promise<MySeason> {
    const { data, error } = await requireSupabase().rpc('my_season');
    if (error) throw error;
    const r = data as Partial<MySeason>;
    return { eligible: Boolean(r.eligible), done: Boolean(r.done), submission: r.submission ?? null };
  },

  async complete(): Promise<{ amount: number; balance: number }> {
    const { data, error } = await requireSupabase().rpc('complete_season_mission');
    if (error) throw error;
    return data as { amount: number; balance: number };
  },

  // ---- Admin → Events. The database checks is_admin() and every field.
  async list(): Promise<AdminSeason[]> {
    const { data, error } = await requireSupabase().rpc('admin_seasons');
    if (error) throw error;
    return (data ?? []) as AdminSeason[];
  },

  async save(s: SeasonInput): Promise<void> {
    cached = null;
    const { error } = await requireSupabase().rpc('admin_save_season', {
      p_key: s.key,
      p_name: s.name,
      p_blurb: s.blurb,
      p_starts: s.startsOn,
      p_ends: s.endsOn,
      p_kind: s.mission?.kind ?? null,
      p_param: s.mission?.param ?? null,
      p_n: s.mission?.n ?? null,
      p_reward: s.mission?.reward ?? null,
      p_frame: s.frame,
      p_event: s.kind,
      p_tracks: s.kind === 'event' ? [] : s.tracks,
      p_close: s.kind === 'event' ? null : s.submissionsClose,
      p_results: s.kind === 'event' ? null : s.resultsAt,
    });
    if (error) throw error;
  },

  async remove(key: string): Promise<void> {
    cached = null;
    const { error } = await requireSupabase().rpc('admin_delete_season', { p_key: key });
    if (error) throw error;
  },
};

export function seasonErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/OVERLAP/.test(msg)) return 'Another event is on those dates. Events can’t overlap.';
  if (/BAD_DATES/.test(msg)) return 'An event ends on or after its first day and lasts at most 31 days.';
  if (/BAD_MISSION/.test(msg)) return 'That Mission isn’t one the hall can check. Pick a kind and fill in what it asks for.';
  if (/BAD_REWARD/.test(msg)) return 'An event Mission pays 5 to 200 PIPs.';
  if (/BAD_NAME/.test(msg)) return 'An event’s name is 2 to 40 characters.';
  if (/BAD_BLURB/.test(msg)) return 'Keep the banner line to 200 characters.';
  if (/NO_SUCH_FRAME/.test(msg)) return 'Pick one of the PIP MART’s frames.';
  if (/BAD_SCHEDULE/.test(msg)) return 'Submissions close after the first day begins, results come after that, and both fall within the event’s dates.';
  if (/BAD_TRACKS/.test(msg)) return 'Up to 6 tracks, each 2 to 30 characters, no two alike.';
  if (/IN_USE/.test(msg)) return 'Entries are already in: their tracks stay, and once awards are recorded submissions can’t reopen.';
  if (/BAD_EVENT_KIND/.test(msg)) return 'Pick an event, a hackathon or a building event.';
  if (/admin_save_season/.test(msg)) return 'The hall’s database needs the hackathons update first. See the deploy guide.';
  if (/ALREADY_STARTED/.test(msg)) return 'An event that has started stays in the hall’s record.';
  if (/NOT_DONE/.test(msg)) return 'Pip hasn’t seen that since the event began. Go and find them, then claim.';
  if (/ALREADY_DONE/.test(msg)) return 'Already claimed.';
  if (/NO_EVENT_MISSION/.test(msg)) return 'The event is over.';
  if (/NOT_ELIGIBLE/.test(msg)) return 'Event Missions pay PIPs once your card is approved.';
  if (/NOT_ADMIN/.test(msg)) return 'Only admins can schedule events.';
  return 'That didn’t work. Try again.';
}
