// The walkable Museum (V2-11, D-119, D-125). Pip walks one long corridor of rooms, in this order:
// the Winners' Hall, each event, each wing, All exhibits, then The Archive. This file plans the
// rooms from what the Museum page already has (nothing new is fetched), lays them out along the
// corridor in pixel units, and puts the walk into words. Pure, so it is unit-tested; the level only
// draws it. Every exhibit, maker and award comes from the data; nothing is invented (rule 7).

import type { Exhibit } from '../types/museum';
import { archiveAsExhibit, archiveAward, archiveCredit, archiveOrigin, byYear, type ArchiveExhibit, type TrophyCase } from './archive';
import { creditLine } from './collab';
import { awardLabel, awardOrder, entriesByTrack, kindOf, type Award, type EventKind, type MuseumEvent } from './events';
import { wingStyle, type RoomStyle, type Wing, type WingRoom } from './wings';

export type RoomKind = 'winners' | 'event' | 'wing' | 'all' | 'archive';

/** A place or award on a plaque, with the event it was won at. */
export interface PlaqueAward {
  award: Award;
  event: string | null;
}

export interface PlannedStop {
  exhibit: Exhibit;
  /** What it won, for the plaque; a winner stands on a pedestal. */
  awards: PlaqueAward[];
}

export interface PlannedGroup {
  /** A sign on the wall before the group (an event in the Winners' Hall, a track, a year). */
  title: string | null;
  sub: string | null;
  stops: PlannedStop[];
}

export interface PlannedRoom {
  /** 'winners', 'event:<key>', 'wing:<key>', 'all' or 'archive'. */
  id: string;
  kind: RoomKind;
  name: string;
  style: RoomStyle;
  wing?: Wing;
  event?: MuseumEvent;
  groups: PlannedGroup[];
}

/** The fixed rooms' styles; wings take the style an admin picked (wingStyle). */
const EVENT_STYLE: Readonly<Record<EventKind, RoomStyle>> = { hackathon: 'arcade', build: 'lab', event: 'garden' };

export interface MuseumParts {
  /** The Winners' Hall's cases, newest first (as the list view shows them). */
  trophies: readonly TrophyCase[];
  /** The event rooms, with the archive's exhibits from each folded in (withArchive). */
  events: readonly MuseumEvent[];
  /** The wings with something on show, each with its exhibits in this visit's order. */
  wings: readonly WingRoom[];
  /** Every exhibit, members' and the archive's: featured projects first, then this visit's order. */
  everything: { featured: readonly Exhibit[]; rest: readonly Exhibit[] };
  archive: readonly ArchiveExhibit[];
}

/** Every announced award, by the project that won it, with its event: plaques show them in any room. */
export function awardsByProject(events: readonly MuseumEvent[], archive: readonly ArchiveExhibit[]): Map<string, PlaqueAward[]> {
  const out = new Map<string, PlaqueAward[]>();
  const add = (id: string, a: PlaqueAward) => out.set(id, [...(out.get(id) ?? []), a]);
  const seen = new Set<string>();
  for (const e of events) {
    for (const award of [...e.awards].sort((a, b) => awardOrder(a, b, e.tracks ?? []))) {
      add(award.project_id, { award, event: e.name });
      seen.add(`${award.project_id}|${award.place ?? award.name}|${award.track ?? ''}`);
    }
  }
  for (const a of archive) {
    const award = archiveAward(a);
    // An archive winner from a recorded event is already in that event's awards.
    if (award && !seen.has(`${award.project_id}|${award.place ?? award.name}|${award.track ?? ''}`)) add(a.id, { award, event: a.event });
  }
  return out;
}

/** The same project twice in a row of winners (two awards at one event) stands once, with both. */
function merge(stops: PlannedStop[]): PlannedStop[] {
  const out: PlannedStop[] = [];
  const at = new Map<string, PlannedStop>();
  for (const s of stops) {
    const there = at.get(s.exhibit.project_id);
    if (there) there.awards.push(...s.awards);
    else {
      const copy = { exhibit: s.exhibit, awards: [...s.awards] };
      at.set(s.exhibit.project_id, copy);
      out.push(copy);
    }
  }
  return out;
}

/** The rooms in walking order. Rooms with nothing on show are left out; their doors stay shut. */
export function planRooms(parts: MuseumParts): PlannedRoom[] {
  const won = awardsByProject(parts.events, parts.archive);
  const stop = (exhibit: Exhibit): PlannedStop => ({ exhibit, awards: won.get(exhibit.project_id) ?? [] });
  const rooms: PlannedRoom[] = [];

  if (parts.trophies.some((t) => t.winners.length > 0)) {
    rooms.push({
      id: 'winners',
      kind: 'winners',
      name: 'Winners’ Hall',
      style: 'trophy',
      groups: parts.trophies.map((t) => ({ title: t.title, sub: t.sub, stops: merge(t.winners.map(({ award, entry }) => ({ exhibit: entry, awards: [{ award, event: t.title }] }))) })),
    });
  }

  for (const e of parts.events) {
    // In its own room, an event's winners lead their track, best award first.
    const rank = (x: Exhibit) => Math.min(9, ...e.awards.filter((a) => a.project_id === x.project_id).map((a) => a.place ?? 4));
    rooms.push({
      id: `event:${e.key}`,
      kind: 'event',
      name: e.name,
      style: EVENT_STYLE[kindOf(e)],
      event: e,
      groups: entriesByTrack(e).map((g) => ({
        title: g.track ? `${g.track} track` : null,
        sub: null,
        stops: [...g.entries].sort((a, b) => rank(a) - rank(b)).map(stop),
      })),
    });
  }

  for (const { wing, exhibits } of parts.wings) {
    rooms.push({ id: `wing:${wing.key}`, kind: 'wing', name: wing.name, style: wingStyle(wing), wing, groups: [{ title: null, sub: null, stops: exhibits.map(stop) }] });
  }

  const { featured, rest } = parts.everything;
  rooms.push({
    id: 'all',
    kind: 'all',
    name: 'All exhibits',
    style: 'garden',
    groups: [
      { title: 'Featured', sub: null, stops: featured.map(stop) },
      { title: featured.length > 0 ? 'More exhibits' : null, sub: null, stops: rest.map(stop) },
    ],
  });

  rooms.push({
    id: 'archive',
    kind: 'archive',
    name: 'The Archive',
    style: 'library',
    groups: byYear(parts.archive).map(({ year, items }) => ({ title: String(year), sub: null, stops: items.map((a) => stop(archiveAsExhibit(a))) })),
  });

  return rooms.filter((r) => r.groups.some((g) => g.stops.length > 0));
}

// ---------------------------------------------------------------- the corridor

/** Distances along the corridor, in pixel units (1u = 4px). */
export const STOP_SPACING = 76;
export const DOOR_GAP = 64;
export const GROUP_GAP = 40;

export interface WalkStop {
  room: number;
  /** Centre of the exhibit on the wall. */
  x: number;
  exhibit: Exhibit;
  awards: PlaqueAward[];
  /** 1-based position in its room. */
  nth: number;
  /** The group it hangs in (an event in the Winners' Hall, a track, a year), for the room's title. */
  group: string | null;
}

export interface WalkSign {
  room: number;
  x: number;
  text: string;
  sub: string | null;
  /** A room's name over its doorway, or a group's sign on the wall. */
  kind: 'door' | 'group';
}

export interface WalkRoom extends PlannedRoom {
  /** The doorway into the room. */
  x0: number;
  /** The doorway out (the next room's x0, or the end wall). */
  x1: number;
  /** Index of its first stop, and how many it has. */
  first: number;
  count: number;
}

export interface WalkLayout {
  rooms: WalkRoom[];
  stops: WalkStop[];
  signs: WalkSign[];
  width: number;
}

/** Hangs the rooms along the corridor: a doorway, then each group's sign and exhibits. */
export function layoutWalk(planned: readonly PlannedRoom[]): WalkLayout {
  const rooms: WalkRoom[] = [];
  const stops: WalkStop[] = [];
  const signs: WalkSign[] = [];
  let x = 0;
  for (const p of planned) {
    if (!p.groups.some((g) => g.stops.length > 0)) continue;
    const room = rooms.length;
    const x0 = x;
    const first = stops.length;
    signs.push({ room, x: x0, text: p.name, sub: null, kind: 'door' });
    x += DOOR_GAP / 2;
    let nth = 0;
    for (const g of p.groups) {
      if (g.stops.length === 0) continue;
      if (g.title) {
        signs.push({ room, x: x + GROUP_GAP / 2, text: g.title, sub: g.sub, kind: 'group' });
        x += GROUP_GAP;
      }
      for (const s of g.stops) {
        stops.push({ room, x: x + STOP_SPACING / 2, exhibit: s.exhibit, awards: s.awards, nth: ++nth, group: g.title });
        x += STOP_SPACING;
      }
    }
    x += DOOR_GAP / 2;
    rooms.push({ ...p, x0, x1: x, first, count: stops.length - first });
  }
  return { rooms, stops, signs, width: x };
}

/** The stop nearest a point on the corridor. */
export function nearestStop(stops: readonly Pick<WalkStop, 'x'>[], x: number): number {
  if (stops.length === 0) return 0;
  let lo = 0;
  let hi = stops.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (stops[mid]!.x < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(stops[lo - 1]!.x - x) <= Math.abs(stops[lo]!.x - x)) return lo - 1;
  return lo;
}

/** The room a point on the corridor is in. */
export function roomAt(rooms: readonly Pick<WalkRoom, 'x0'>[], x: number): number {
  let r = 0;
  for (let i = 0; i < rooms.length; i++) if (rooms[i]!.x0 <= x) r = i;
  return r;
}

/** The stops within `reach` units of the camera: the only ones mounted and drawn. */
export function stopsNear(stops: readonly Pick<WalkStop, 'x'>[], cam: number, reach: number): [number, number] {
  if (stops.length === 0) return [0, -1];
  const a = nearestStop(stops, cam - reach);
  const b = nearestStop(stops, cam + reach);
  return [Math.max(0, stops[a]!.x < cam - reach ? a + 1 : a), Math.min(stops.length - 1, stops[b]!.x > cam + reach ? b - 1 : b)];
}

/** Release speed (CSS px per ms) that steps exactly one exhibit, as in the hall. */
export const WALK_FLICK = 0.5;

/** Where Pip goes after a drag: one exhibit on for a flick, otherwise the nearest. */
export function releaseStop(stops: readonly Pick<WalkStop, 'x'>[], cam: number, current: number, flick: number): number {
  if (stops.length === 0) return 0;
  if (Math.abs(flick) > WALK_FLICK) return Math.max(0, Math.min(stops.length - 1, current + (flick < 0 ? 1 : -1)));
  return nearestStop(stops, cam);
}

/** A drag may pull the camera a little past the first and last exhibit, against a stiff band. */
export function walkBand(stops: readonly Pick<WalkStop, 'x'>[], cam: number): number {
  if (stops.length === 0) return 0;
  const min = stops[0]!.x - STOP_SPACING * 0.4;
  const max = stops[stops.length - 1]!.x + STOP_SPACING * 0.4;
  if (cam < min) return min + (cam - min) * 0.3;
  if (cam > max) return max + (cam - max) * 0.3;
  return cam;
}

// ---------------------------------------------------------------- the address

/** The room's place in the address, the same as the list view's: ?room=winners, ?event=…, ?wing=…, ?room=all, ?room=archive. */
export function roomParams(id: string): [string, string] {
  if (id.startsWith('event:')) return ['event', id.slice(6)];
  if (id.startsWith('wing:')) return ['wing', id.slice(5)];
  return ['room', id];
}

/** The room an address asks for, if any. */
export function roomFromParams(params: URLSearchParams): string | null {
  const event = params.get('event');
  if (event) return `event:${event}`;
  const wing = params.get('wing');
  if (wing) return `wing:${wing}`;
  const room = params.get('room');
  return room === 'winners' || room === 'all' || room === 'archive' ? room : null;
}

// ---------------------------------------------------------------- words

/** Who made it, for the plaque: "Ana Cruz with Bo and Cy", an archive's credit, or null. */
export function plaqueBy(e: Exhibit): string | null {
  if (e.archive) return e.archive.team_size > 0 ? archiveCredit(e.archive) : null;
  const others = (e.project.collaborators ?? []).map((c) => c.full_name);
  return others.length > 0 ? `${e.full_name} with ${creditLine(others)}` : e.full_name;
}

/** "1st place · Spring Hackathon", "Best UI · Health track · Spring Hackathon". */
export const awardLine = (a: PlaqueAward) => [awardLabel(a.award), a.event].filter(Boolean).join(' · ');

/** Where an exhibit came from, when the plaque should say: the archive's origin. */
export const plaqueOrigin = (e: Exhibit) => (e.archive ? archiveOrigin(e.archive) : null);

/** Pip's line when it stops in front of an exhibit. */
export function stopLine(layout: Pick<WalkLayout, 'rooms' | 'stops'>, i: number): string {
  const s = layout.stops[i];
  if (!s) return '';
  const room = layout.rooms[s.room]!;
  const by = plaqueBy(s.exhibit);
  const won = s.awards[0] ? ` ${awardLine(s.awards[0])}.` : '';
  return `${room.name}, ${s.nth} of ${room.count}: ${s.exhibit.project.title}${by ? `, by ${by}` : ''}.${won} OPEN visits it.`;
}

export interface RoomMaker {
  /** A member's username (their badge), or null for a named maker who isn't a member. */
  username: string | null;
  name: string;
  /** The first stop of theirs in the room, so Pip can walk there. */
  stop: number;
}

/** Everyone who made something in the room, once each, in walking order. Archive makers appear only
 *  where the archive may name them (D-118); unnamed makers are not listed. */
export function roomMakers(layout: Pick<WalkLayout, 'rooms' | 'stops'>, room: number): RoomMaker[] {
  const r = layout.rooms[room];
  if (!r) return [];
  const out: RoomMaker[] = [];
  const seen = new Set<string>();
  const add = (username: string | null | undefined, name: string | null | undefined, stop: number) => {
    const label = name?.trim();
    if (!label) return;
    const key = username ? `@${username}` : `#${label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ username: username || null, name: label, stop });
  };
  for (let i = r.first; i < r.first + r.count; i++) {
    const e = layout.stops[i]!.exhibit;
    if (e.archive) for (const m of e.archive.makers) add(m.username, m.full_name, i);
    else {
      add(e.username, e.full_name, i);
      for (const c of e.project.collaborators ?? []) add(c.username, c.full_name, i);
    }
  }
  return out;
}
