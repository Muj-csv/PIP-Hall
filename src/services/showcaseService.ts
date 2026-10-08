// The showcase (V2-12, D-109, D-120, D-127): the kiosk's check-in QR. A scanned link carries the
// event's key and its check-in code; the database says whether the code is the event's current one
// and the event is on, and records a member's check-in (one per event, no PIPs). Guests keep the
// stamp on their device (usePassport). Admins make and renew the code for the kiosk's link.
// Without a database there are no events, so no check-ins: none are invented (rule 7).

import { requireSupabase } from './supabase';

const useSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export interface CheckinEvent {
  key: string;
  name: string;
  /** The event is on now (Manila calendar). */
  live: boolean;
  /** The link's code is the event's current one and the event is on: scanning it stamps. */
  ok: boolean;
}

export type CheckinError = 'BAD_CODE' | 'NOT_LIVE' | 'NO_SUCH_EVENT';

/** The database's reason a check-in was refused, if it gave one. */
export function checkinError(e: unknown): CheckinError | null {
  const m = (e as { message?: string } | null)?.message ?? '';
  const hit = /BAD_CODE|NOT_LIVE|NO_SUCH_EVENT/.exec(m);
  return hit ? (hit[0] as CheckinError) : null;
}

export const showcaseService = {
  /** What a scanned check-in link is for; null when there is no such event. */
  async event(key: string, code: string): Promise<CheckinEvent | null> {
    if (!useSupabase) return null;
    const { data, error } = await requireSupabase().rpc('checkin_event', { p_key: key, p_code: code });
    if (error) throw error;
    return (data as CheckinEvent | null) ?? null;
  },

  /** A member checks in. True if new; false if already checked in or their card isn't in the hall. */
  async checkIn(key: string, code: string): Promise<boolean> {
    const { data, error } = await requireSupabase().rpc('check_in', { p_key: key, p_code: code });
    if (error) throw error;
    return Boolean(data);
  },

  /** Admins: the event's check-in code for the kiosk's link; `renew` makes a new one. */
  async code(key: string, renew = false): Promise<string> {
    const { data, error } = await requireSupabase().rpc('admin_checkin_code', { p_key: key, p_renew: renew });
    if (error) throw error;
    return String(data);
  },
};
