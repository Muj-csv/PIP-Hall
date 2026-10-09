// Hackathons and building events (V2-9, D-115 to D-117). An admin schedules an event with a kind,
// tracks and a schedule; members submit projects while submissions are open; admins record places
// and named awards with judges' notes and announce them once. The database decides every phase
// and every winner (museum_events(), hall_awards()); this file turns them into words, countdowns
// and ribbons. Event, track and award names are the admins' words, never ours (D-029, D-067).

import type { Exhibit } from '../types/museum';
import { dateRange, type Season } from './seasons';

export type EventKind = 'event' | 'hackathon' | 'build';
/** upcoming → live → over (plain events); upcoming → open → judging → results (hackathons, building events). */
export type EventPhase = 'upcoming' | 'live' | 'over' | 'open' | 'judging' | 'results';

export const EVENT_KINDS: readonly { value: EventKind; label: string }[] = [
  { value: 'event', label: 'Event (no submissions)' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'build', label: 'Building event' },
];

export const KIND_NAME: Readonly<Record<EventKind, string>> = { event: 'Event', hackathon: 'Hackathon', build: 'Building event' };

export const MAX_TRACKS = 6;

export function kindOf(s: Pick<Season, 'kind'>): EventKind {
  return s.kind === 'hackathon' || s.kind === 'build' ? s.kind : 'event';
}

/** Takes submissions (a hackathon or a building event). */
export const takesEntries = (s: Pick<Season, 'kind'>) => kindOf(s) !== 'event';

export interface Award {
  id?: number;
  place: 1 | 2 | 3 | null;
  name: string | null;
  track: string | null;
  note?: string;
  project_id: string;
}

/** An event's submission, as an exhibit (it hangs in the event's room), with its track. */
export interface EventEntry extends Exhibit {
  track: string | null;
}

/** An event as the Museum sees it: museum_events(). */
export interface MuseumEvent extends Season {
  entries: EventEntry[];
  /** Only once announced. */
  awards: Award[];
}

/** One award a member's project won, for their badge and profile: hall_awards(). */
export interface HallAward {
  event_key: string;
  event: string;
  place: 1 | 2 | 3 | null;
  name: string | null;
  track: string | null;
  project_id: string;
  title: string | null;
  at: string;
}

const PLACES = ['1st place', '2nd place', '3rd place'] as const;

/** "1st place", "Best UI", "Best UI · Health track". */
export function awardLabel(a: Pick<Award, 'place' | 'name' | 'track'>, withTrack = true): string {
  const what = a.place ? PLACES[a.place - 1]! : (a.name ?? 'An award');
  return withTrack && a.track ? `${what} · ${a.track} track` : what;
}

/** Which ribbon the badge wears: a rosette with the number for a place, a star for a named award. */
export type RibbonKind = 'p1' | 'p2' | 'p3' | 'award';
export const ribbonOf = (a: Pick<Award, 'place'>): RibbonKind => (a.place ? (`p${a.place}` as RibbonKind) : 'award');

/** Winners first by importance: overall places, overall awards, then each track's places and awards. */
export function awardOrder(a: Award, b: Award, tracks: readonly string[] = []): number {
  const t = (x: Award) => (x.track === null ? -1 : Math.max(0, tracks.indexOf(x.track)));
  return t(a) - t(b) || (a.place ?? 9) - (b.place ?? 9) || (a.name ?? '').localeCompare(b.name ?? '');
}

/** Each announced award with the entry it went to (an award whose project left the card is skipped). */
export function winnersOf(e: Pick<MuseumEvent, 'awards' | 'entries' | 'tracks'>): { award: Award; entry: EventEntry }[] {
  const byId = new Map(e.entries.map((x) => [x.project_id, x]));
  return [...e.awards]
    .sort((a, b) => awardOrder(a, b, e.tracks ?? []))
    .flatMap((award) => {
      const entry = byId.get(award.project_id);
      return entry ? [{ award, entry }] : [];
    });
}

/**
 * The Museum shows an event's winners only (D-130): an entry hangs in its room once it has won a
 * place or an award there (awards are public only once announced). Its other entries stay on their
 * makers' cards. The archive adds its own exhibits afterwards (withArchive); a room left with
 * nothing on show is not drawn (rule 7).
 */
export function curatedEvents(events: readonly MuseumEvent[]): MuseumEvent[] {
  return events.map((e) => {
    const won = new Set(e.awards.map((a) => a.project_id));
    return { ...e, entries: e.entries.filter((x) => won.has(x.project_id)) };
  });
}

/** The entries in each track, in the event's track order; an event without tracks has one group. */
export function entriesByTrack(e: Pick<MuseumEvent, 'entries' | 'tracks'>): { track: string | null; entries: EventEntry[] }[] {
  const tracks = e.tracks ?? [];
  if (tracks.length === 0) return e.entries.length ? [{ track: null, entries: e.entries }] : [];
  const groups = tracks.map((track) => ({ track, entries: e.entries.filter((x) => x.track === track) }));
  const loose = e.entries.filter((x) => !x.track || !tracks.includes(x.track));
  return [...groups, ...(loose.length ? [{ track: null, entries: loose }] : [])].filter((g) => g.entries.length > 0);
}

/** "in 2 days", "in 5 hours", "in 12 min", "any moment now". */
export function countdown(target: string | null | undefined, now = Date.now()): string {
  const at = target ? Date.parse(target) : NaN;
  if (Number.isNaN(at)) return '';
  const s = Math.round((at - now) / 1000);
  if (s <= 60) return 'any moment now';
  if (s < 3600) return `in ${Math.ceil(s / 60)} min`;
  if (s < 48 * 3600) {
    const h = Math.round(s / 3600);
    return `in ${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  return `in ${Math.round(s / 86400)} days`;
}

/** "Sat 12 Oct, 6:00 pm" on the hall's calendar (Manila). */
export function manilaTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Where the event stands, in a few words, for the banner and the hall panel. */
export function phaseLine(s: Season, now = Date.now()): string {
  switch (s.phase) {
    case 'open':
      return `Submissions close ${countdown(s.submissions_close, now)}`;
    case 'judging':
      return `Judging · results ${countdown(s.results_at, now)}`;
    case 'results':
      return 'Results are in!';
    case 'upcoming':
      return takesEntries(s) ? `Submissions open ${dateRange(s.starts_on, s.starts_on)}` : '';
    default:
      return '';
  }
}

/** The Museum room of an event. */
export const eventRoomPath = (key: string) => `/museum?event=${encodeURIComponent(key)}`;

// ---- The admin form works on the hall's calendar: a datetime-local value is Manila time (UTC+8).
const MANILA_MS = 8 * 3600_000;

/** "2026-10-12T18:00" (Manila) → an ISO instant. */
export function fromManilaInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - MANILA_MS).toISOString();
}

/** An ISO instant → "2026-10-12T18:00" (Manila), for a datetime-local field. */
export function toManilaInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t + MANILA_MS).toISOString().slice(0, 16);
}

/** "Health, Education" → ["Health", "Education"]: trimmed, blanks dropped. */
export function parseTracks(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
