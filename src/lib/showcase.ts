// The showcase (V2-12, D-109, D-120, D-127): the Museum beyond a laptop display. The kiosk tours its
// rooms, placards hang beside the demos, a placard's QR opens the exhibit on a phone (and offers the
// next one in the room), and the kiosk's check-in QR stamps a Passport. All of it walks the same
// rooms as the walkable Museum (planRooms), in one fixed order (the Museum's own shuffles on every
// visit), so a printed placard's "next in this room" is the one hanging beside it. Pure: every
// exhibit, maker, award and note comes from the data (rule 7).

import { archiveAsExhibit, archiveCases, withArchive, type ArchiveExhibit, type TrophyCase } from './archive';
import { KIND_NAME, kindOf, winnersOf, type MuseumEvent } from './events';
import { plaqueBy, planRooms, type MuseumParts, type PlaqueAward, type PlannedRoom } from './museumWalk';
import { exhibitPath, exhibitUrl, publicOrigin } from './publicUrl';
import { dateRange } from './seasons';
import { wingRooms, type Wing, type WingContext } from './wings';
import type { Exhibit } from '../types/museum';

/** A hall event's case in the Winners' Hall. */
export const eventCase = (e: MuseumEvent): TrophyCase => ({
  key: e.key,
  title: e.name,
  sub: `${KIND_NAME[kindOf(e)]} · ${dateRange(e.starts_on, e.ends_on)}`,
  eventKey: e.key,
  year: null,
  sort: e.starts_on,
  winners: winnersOf(e),
});

export interface MuseumData {
  /** museum_exhibits(): members' exhibits on show. */
  exhibits: readonly Exhibit[];
  wings: readonly Wing[];
  events: readonly MuseumEvent[];
  archive: readonly ArchiveExhibit[];
}

/** The kiosk's pace: seconds per exhibit and per badge, the minute untouched before it plays on,
 *  and how often it reads the check-in again. */
export const BOOTH = { tourMs: 12_000, hallMs: 8_000, idleMs: 60_000, checkinMs: 5 * 60_000 } as const;

const byTitle = (a: Exhibit, b: Exhibit) => a.project.title.localeCompare(b.project.title) || a.project_id.localeCompare(b.project_id);

/** The Museum's rooms in walking order, each in a fixed order: featured projects first, then by title. */
export function showcaseRooms(d: MuseumData, ctx: WingContext = {}): PlannedRoom[] {
  const everything = [...d.exhibits, ...d.archive.map(archiveAsExhibit)];
  const events = withArchive(d.events, d.archive);
  const fixed = (list: readonly Exhibit[]) => ({ featured: list.filter((e) => e.featured).sort(byTitle), rest: list.filter((e) => !e.featured).sort(byTitle) });
  const trophies = [...events.map(eventCase), ...archiveCases(d.archive, new Set(events.map((e) => e.key)))]
    .filter((t) => t.winners.length > 0)
    .sort((a, b) => b.sort.localeCompare(a.sort));
  const parts: MuseumParts = {
    trophies,
    events,
    wings: wingRooms(d.wings, everything, ctx).map((r) => {
      const o = fixed(r.exhibits);
      return { wing: r.wing, exhibits: [...o.featured, ...o.rest] };
    }),
    everything: fixed(everything),
    archive: d.archive,
  };
  return planRooms(parts);
}

export interface ShowcaseStop {
  exhibit: Exhibit;
  awards: PlaqueAward[];
  /** The room it hangs in here, e.g. 'event:spring-hack' or 'wing:web'. */
  room: string;
  roomName: string;
}

/** A room's exhibits in walking order, each once. */
export function roomStops(room: PlannedRoom): ShowcaseStop[] {
  const seen = new Set<string>();
  return room.groups.flatMap((g) =>
    g.stops.flatMap((s) => (seen.has(s.exhibit.project_id) ? [] : (seen.add(s.exhibit.project_id), [{ exhibit: s.exhibit, awards: s.awards, room: room.id, roomName: room.name }]))),
  );
}

/** The kiosk's tour: the event's room when the kiosk is for an event that has one (its winners
 *  first, as in the room), otherwise every room in walking order, each exhibit once. */
export function tourStops(rooms: readonly PlannedRoom[], eventKey: string | null): ShowcaseStop[] {
  const own = eventKey ? rooms.find((r) => r.id === `event:${eventKey}`) : undefined;
  if (own) return roomStops(own);
  const seen = new Set<string>();
  return rooms.flatMap(roomStops).filter((s) => !seen.has(s.exhibit.project_id) && (seen.add(s.exhibit.project_id), true));
}

/** The exhibit after this one in the room (round the room), or null when it's alone there or not in it. */
export function nextInRoom(rooms: readonly PlannedRoom[], roomId: string, projectId: string): { stop: ShowcaseStop; nth: number; count: number } | null {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const stops = roomStops(room);
  const at = stops.findIndex((s) => s.exhibit.project_id === projectId);
  if (at < 0 || stops.length < 2) return null;
  const nth = (at + 1) % stops.length;
  return { stop: stops[nth]!, nth: nth + 1, count: stops.length };
}

// ---------------------------------------------------------------- placards

export type PrintTarget = { kind: 'event'; key: string } | { kind: 'room'; id: string } | { kind: 'exhibit'; id: string };

/** What /print?… asks for: ?event=key, ?room=<room id> or ?exhibit=<id>. */
export function printTarget(params: URLSearchParams): PrintTarget | null {
  const event = params.get('event');
  if (event) return { kind: 'event', key: event };
  const room = params.get('room');
  if (room) return { kind: 'room', id: room };
  const exhibit = params.get('exhibit');
  return exhibit ? { kind: 'exhibit', id: exhibit } : null;
}

export function printPath(t: PrintTarget): string {
  const [k, v] = t.kind === 'event' ? ['event', t.key] : t.kind === 'room' ? ['room', t.id] : ['exhibit', t.id];
  return `/print?${new URLSearchParams({ [k]: v })}`;
}

export interface Placard {
  exhibit: Exhibit;
  title: string;
  /** "Ana Cruz with Bo", a team's credit, or null when the archive may not name them. */
  by: string | null;
  team: string | null;
  /** The event and year it belongs to, as far as the data says: "Spring Hackathon · 2026". */
  origin: string | null;
  awards: PlaqueAward[];
  /** The first judges' note among its awards. */
  note: string | null;
  room: string;
  roomName: string;
  /** What its QR opens: the exhibit on a phone, as a placard scan. */
  qr: string;
}

const yearOf = (iso: string | null | undefined) => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : null);

export function placardFor(s: ShowcaseStop, room?: PlannedRoom): Placard {
  const e = s.exhibit;
  const event = room?.event?.name ?? e.archive?.event ?? s.awards[0]?.event ?? null;
  const year = e.archive ? String(e.archive.year) : room?.event ? yearOf(room.event.starts_on) : yearOf(e.project.project_date);
  return {
    exhibit: e,
    title: e.project.title,
    by: plaqueBy(e),
    team: e.archive?.team_name ?? null,
    origin: [event, event && year && event.includes(year) ? null : year].filter(Boolean).join(' · ') || null,
    awards: s.awards,
    note: s.awards.map((a) => a.award.note?.trim()).find(Boolean) ?? null,
    room: s.room,
    roomName: s.roomName,
    qr: placardUrl(e.project_id, s.room),
  };
}

/** The placards a print page asks for: an event's room, a room, or one exhibit (in the first room
 *  it hangs in, so its "next" is that room's). Null when there's no such room or exhibit. */
export function placardsFor(rooms: readonly PlannedRoom[], t: PrintTarget): { title: string; placards: Placard[] } | null {
  if (t.kind === 'exhibit') {
    for (const room of rooms) {
      const s = roomStops(room).find((x) => x.exhibit.project_id === t.id);
      if (s) return { title: s.exhibit.project.title, placards: [placardFor(s, room)] };
    }
    return null;
  }
  const room = rooms.find((r) => r.id === (t.kind === 'event' ? `event:${t.key}` : t.id));
  return room ? { title: room.name, placards: roomStops(room).map((s) => placardFor(s, room)) } : null;
}

/** Placards on A4 sheets, four to a page. */
export function sheets<T>(items: readonly T[], per = 4): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

// ---------------------------------------------------------------- links

/** A placard's QR: the exhibit, marked as a placard scan, with the room it hangs in. */
export function placardUrl(projectId: string, room: string): string {
  return `${exhibitUrl(projectId)}?${new URLSearchParams({ via: 'placard', room })}`;
}

/** Walking on from a placard's exhibit: the next one, still in the room (no greeting). */
export function inRoomPath(projectId: string, room: string): string {
  return `${exhibitPath(projectId)}?${new URLSearchParams({ room })}`;
}

export const checkinPath = (key: string) => `/checkin/${encodeURIComponent(key)}`;

/** The kiosk's check-in QR. */
export function checkinUrl(key: string, code: string): string {
  return `${publicOrigin()}${checkinPath(key)}?${new URLSearchParams({ c: code })}`;
}

/** The kiosk, for an event (with its check-in code, so its QR stamps) or the whole Museum. */
export function boothPath(key?: string | null, code?: string | null): string {
  const q = new URLSearchParams();
  if (key) q.set('event', key);
  if (key && code) q.set('c', code);
  const s = q.toString();
  return s ? `/booth?${s}` : '/booth';
}
