// The Passport (V2-2, D-097, D-098): what you've discovered in the hall. Stamps are ids and dates;
// the pages are worked out from the hall's published cards and exhibits, so nothing here can show
// a person, project or skill that isn't really on show. Pure, so the device and account versions
// share it and tests can check every page.

import type { PublicCard, PublicProject } from '../types/card';
import type { Exhibit } from '../types/museum';
import { normalize } from './search';

export interface Stamp {
  /** A member's profile id, or an exhibit's project id. */
  id: string;
  /** ISO date and time of the stamp. */
  at: string;
  /** Brought over from a device Passport: history only, never PIPs (D-097). */
  imported?: boolean;
}

export interface PassportData {
  people: Stamp[];
  exhibits: Stamp[];
}

export const EMPTY_PASSPORT: PassportData = { people: [], exhibits: [] };

/** Adds a stamp if it's new. Returns the same object when nothing changed. */
export function stamp(data: PassportData, kind: keyof PassportData, id: string, at = new Date().toISOString()): PassportData {
  if (!id || data[kind].some((s) => s.id === id)) return data;
  return { ...data, [kind]: [...data[kind], { id, at }] };
}

/** Stamps on this device that the account doesn't have yet (what a graduation import would add). */
export function missingFrom(device: PassportData, account: PassportData): PassportData {
  const has = (list: Stamp[], id: string) => list.some((s) => s.id === id);
  return {
    people: device.people.filter((s) => !has(account.people, s.id)),
    exhibits: device.exhibits.filter((s) => !has(account.exhibits, s.id)),
  };
}

/** Reads a stored Passport, dropping anything malformed (storage is the visitor's to edit). */
export function parsePassport(raw: unknown): PassportData {
  const list = (v: unknown): Stamp[] =>
    Array.isArray(v)
      ? v
          .filter((s): s is Stamp => typeof s === 'object' && s !== null && typeof (s as Stamp).id === 'string' && typeof (s as Stamp).at === 'string' && !Number.isNaN(Date.parse((s as Stamp).at)))
          .slice(0, 1000)
          .map((s) => ({ id: s.id, at: s.at, ...(s.imported ? { imported: true } : {}) }))
      : [];
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<PassportData>;
  return { people: list(o.people), exhibits: list(o.exhibits) };
}

export interface TeamProject {
  project: PublicProject;
  owner: PublicCard;
  /** Owner first, then each credited collaborator still in the hall. */
  makers: PublicCard[];
}

/** Every project in the hall made by more than one member who is still in the hall. */
export function teamProjects(cards: readonly PublicCard[]): TeamProject[] {
  const byName = new Map(cards.map((c) => [c.username, c]));
  return cards.flatMap((owner) =>
    owner.card.projects.flatMap((project) => {
      const others = (project.collaborators ?? []).map((m) => byName.get(m.username)).filter((c): c is PublicCard => Boolean(c));
      return others.length ? [{ project, owner, makers: [owner, ...others] }] : [];
    }),
  );
}

export interface PassportPages {
  people: { card: PublicCard; stamp: Stamp }[];
  peopleTotal: number;
  /** Skills listed by the people you've met, with who showed you first. */
  skills: { name: string; from: PublicCard }[];
  skillsTotal: number;
  /** Team projects where you've met every maker. */
  collaborations: TeamProject[];
  collaborationsTotal: number;
  exhibits: { exhibit: Exhibit; stamp: Stamp }[];
  /** Null while the Museum hasn't loaded. */
  exhibitsTotal: number | null;
}

export function passportPages(data: PassportData, cards: readonly PublicCard[], exhibits: readonly Exhibit[] | null, me: string | null = null): PassportPages {
  const others = cards.filter((c) => c.profile_id !== me);
  const byId = new Map(others.map((c) => [c.profile_id, c]));
  const people = data.people
    .map((s) => ({ card: byId.get(s.id), stamp: s }))
    .filter((p): p is { card: PublicCard; stamp: Stamp } => Boolean(p.card));
  const met = new Set(people.map((p) => p.card.profile_id));

  const allSkills = new Set(others.flatMap((c) => (c.card.skills ?? []).map(normalize)));
  const seen = new Map<string, { name: string; from: PublicCard }>();
  for (const p of people) for (const s of p.card.card.skills ?? []) if (!seen.has(normalize(s))) seen.set(normalize(s), { name: s, from: p.card });

  const teams = teamProjects(cards).filter((t) => t.makers.some((m) => m.profile_id !== me));
  const collaborations = teams.filter((t) => t.makers.every((m) => m.profile_id === me || met.has(m.profile_id)));

  const shown = exhibits?.filter((e) => e.username !== cards.find((c) => c.profile_id === me)?.username) ?? null;
  const exById = new Map((shown ?? []).map((e) => [e.project_id, e]));
  const visited = data.exhibits
    .map((s) => ({ exhibit: exById.get(s.id), stamp: s }))
    .filter((v): v is { exhibit: Exhibit; stamp: Stamp } => Boolean(v.exhibit));

  return {
    people,
    peopleTotal: others.length,
    skills: [...seen.values()],
    skillsTotal: allSkills.size,
    collaborations,
    collaborationsTotal: teams.length,
    exhibits: visited,
    exhibitsTotal: shown ? shown.length : null,
  };
}

/** "6 Oct" for a stamp date, in the reader's own calendar. */
export function stampDate(at: string): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
