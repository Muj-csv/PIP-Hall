// Seasons and events (V2-7, D-103): an admin schedules an event (e.g. Build Week) with dates, a
// blurb for the banner, an optional event Mission and an optional limited frame. The database
// decides what is live (current_season()) and checks the Mission before paying; this file turns
// an event into words. Counters are real numbers from public hall_events; nothing is made up.

import type { EventKind, EventPhase } from './events';
import { makeMission, type Mission, type MissionKind } from './missions';

export interface SeasonMission {
  kind: MissionKind;
  param: string | null;
  n: number;
  reward: number;
}

export interface Season {
  key: string;
  name: string;
  blurb: string;
  /** Dates on the hall's calendar (Asia/Manila), first and last day, YYYY-MM-DD. */
  starts_on: string;
  ends_on: string;
  mission: SeasonMission | null;
  frame: { key: string; name: string; price: number } | null;
  /** Only for a live event: what happened in the hall during it. */
  counts: { joined: number; projects: number; exhibits: number; teamups: number; submissions?: number; checkins?: number } | null;
  // Hackathons and building events (V2-9, D-115). Missing before the hackathons update: a plain event.
  kind?: EventKind;
  tracks?: string[];
  submissions_close?: string | null;
  results_at?: string | null;
  announced_at?: string | null;
  phase?: EventPhase;
}

export interface CurrentSeason {
  live: Season | null;
  next: Season | null;
  /** An event whose results were announced in the last 7 days. */
  results: Season | null;
}

export const NO_SEASON: CurrentSeason = { live: null, next: null, results: null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return { y: y!, m: m! - 1, d: day! };
};

/** "6–12 Oct", "28 Oct – 3 Nov", "6 Oct" (one day), with the year when it isn't this one. */
export function dateRange(starts: string, ends: string, thisYear = new Date().getFullYear()): string {
  const a = parts(starts);
  const b = parts(ends);
  const year = b.y !== thisYear ? ` ${b.y}` : '';
  if (starts === ends) return `${a.d} ${MONTHS[a.m]}${year}`;
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${MONTHS[b.m]}${year}`;
  return `${a.d} ${MONTHS[a.m]}${a.y !== b.y ? ` ${a.y}` : ''} – ${b.d} ${MONTHS[b.m]}${year}`;
}

/** The event's Mission as a Mission (for its words, its Go button and the Passport check). */
export function seasonMission(s: Season): Mission | null {
  if (!s.mission) return null;
  const m = makeMission('season', s.key, s.mission.kind, s.mission.param, s.mission.n);
  return { ...m, key: `season:${s.key}` };
}

/** When the event began: midnight on its first day, Manila time (UTC+8). */
export function seasonStart(s: Season): Date {
  const { y, m, d } = parts(s.starts_on);
  return new Date(Date.UTC(y, m, d) - 8 * 3600_000);
}

/** "3 joined · 5 projects · 2 exhibits · 1 team-up": every number real, zeros included. An event
 *  that takes submissions says how many first; one whose showcase has checked people in (V2-12)
 *  says how many last. */
export function countsLine(c: NonNullable<Season['counts']>, entries = false): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  return [
    ...(entries ? [n(c.submissions ?? 0, 'entry', 'entries')] : []),
    n(c.joined, 'joined', 'joined'),
    n(c.projects, 'project', 'projects'),
    n(c.exhibits, 'exhibit', 'exhibits'),
    n(c.teamups, 'team-up', 'team-ups'),
    ...(c.checkins ? [n(c.checkins, 'checked in at the showcase', 'checked in at the showcase')] : []),
  ].join(' · ');
}
