// The Museum, curated end to end (V2-20, D-133). The admins decide what hangs and how the rooms are
// arranged; this file reads that arrangement (museum_curation()) and applies it to the rooms the
// Museum already plans: the order and signs of the rooms, which are shut, the featured members who
// hang as portraits, and the exhibits hand-picked into wings. Pure, so it is unit-tested.

import type { PublicCard, PublicProject } from '../types/card';
import { exhibitPath, memberPath } from './publicUrl';
import type { Exhibit, MuseumCuration, RoomLayout } from '../types/museum';

/** Nothing arranged: every room in its usual order, no portraits, no picks. */
export const NO_CURATION: MuseumCuration = { rooms: [], portraits: [], picks: [] };

/** The Featured Members room's id, in the address (?room=members) and in the admins' layout. */
export const MEMBERS_ROOM = 'members';

const ROOM_KEY = /^(winners|members|all|archive|(event|wing):[a-z0-9][a-z0-9-]{1,23})$/;

/** Parses museum_curation(), dropping anything malformed. */
export function parseCuration(raw: unknown): MuseumCuration {
  if (!raw || typeof raw !== 'object') return NO_CURATION;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : []);
  return {
    rooms: list(o.rooms).flatMap((r) =>
      typeof r.key === 'string' && ROOM_KEY.test(r.key)
        ? [{ key: r.key, sign: typeof r.sign === 'string' && r.sign.trim() ? r.sign.trim() : null, hidden: r.hidden === true }]
        : [],
    ),
    portraits: list(o.portraits).flatMap((p) => (typeof p.member_id === 'string' ? [{ member_id: p.member_id, note: typeof p.note === 'string' ? p.note : '' }] : [])),
    picks: list(o.picks).flatMap((p) => (typeof p.wing === 'string' && typeof p.project_id === 'string' ? [{ wing: p.wing, project_id: p.project_id }] : [])),
  };
}

/** The hand-picked exhibits of each wing, in the admins' order. */
export function picksByWing(c: MuseumCuration): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of c.picks) out.set(p.wing, [...(out.get(p.wing) ?? []), p.project_id]);
  return out;
}

/** A featured member's portrait, as an exhibit so every view can hang it: their badge and the note. */
export function portraitExhibit(card: PublicCard, note: string): Exhibit {
  const id = `member:${card.username}`;
  const project: PublicProject = {
    id,
    title: card.card.full_name,
    description: note || null,
    language: null,
    tech_stack: [],
    stars: null,
    github_url: null,
    project_url: null,
    cover_path: null,
    source: 'manual',
    project_date: null,
    collaborators: [],
  };
  return {
    project_id: id,
    username: card.username,
    full_name: card.card.full_name,
    avatar_path: card.card.avatar_path ?? null,
    member_no: card.member_no,
    featured: true,
    console: null,
    project,
    portrait: { card, note },
  };
}

/** Where a stop leads: a portrait to its member's profile, an exhibit to its own page. */
export const stopPath = (e: Pick<Exhibit, 'portrait' | 'username' | 'project_id'>): string => (e.portrait ? memberPath(e.username) : exhibitPath(e.project_id));

/** The featured members on show, in the order the database gives (member number), with their notes. */
export function portraits(c: MuseumCuration, cards: readonly PublicCard[]): Exhibit[] {
  const byId = new Map(cards.map((x) => [x.profile_id, x]));
  return c.portraits.flatMap((p) => {
    const card = byId.get(p.member_id);
    return card ? [portraitExhibit(card, p.note)] : [];
  });
}

/** The room's layout, if the admins arranged it. */
export const layoutOf = (c: Pick<MuseumCuration, 'rooms'>, key: string): RoomLayout | undefined => c.rooms.find((r) => r.key === key);

/** Whether the admins shut a room (a shut room keeps its exhibits; its door is closed). */
export const isShut = (c: Pick<MuseumCuration, 'rooms'>, key: string): boolean => layoutOf(c, key)?.hidden === true;

/** The name on a room's door: the admins' sign, or the room's own name. */
export const signOf = (c: Pick<MuseumCuration, 'rooms'>, key: string, name: string): string => layoutOf(c, key)?.sign ?? name;

/**
 * The rooms as the admins arranged them: those they placed first, in their order, then the rest in
 * their usual order; shut rooms left out; each with the sign on its door.
 */
export function arrangeRooms<T extends { id: string; name: string }>(rooms: readonly T[], c: Pick<MuseumCuration, 'rooms'>): T[] {
  const place = new Map(c.rooms.map((r, i) => [r.key, i]));
  return rooms
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !isShut(c, r.id))
    .sort((a, b) => (place.get(a.r.id) ?? c.rooms.length + a.i) - (place.get(b.r.id) ?? c.rooms.length + b.i))
    .map(({ r }) => ({ ...r, name: signOf(c, r.id, r.name) }));
}
