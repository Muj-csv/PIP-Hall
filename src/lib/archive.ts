// The archive (V2-10, D-118, D-122): past projects and hackathon outputs compiled by admins. The
// database decides what is on show and whose names may be shown (museum_archive()); this file turns
// an archive exhibit into a Museum exhibit, so it hangs in the rooms and wings like any other, and
// into words: who made it (members by their badge, other makers only with their consent, else the
// team), and where it came from. Nothing here invents a maker or an award (rule 7).

import type { Exhibit } from '../types/museum';
import { awardOrder, type Award, type EventEntry, type MuseumEvent } from './events';

export interface ArchiveMaker {
  /** Set for members of the hall: their badge. Typed names have none. */
  username?: string | null;
  full_name: string | null;
  member_no?: number | null;
}

export interface ArchiveAward {
  place: 1 | 2 | 3 | null;
  name: string | null;
  /** The track, when the award was for one track. */
  track: string | null;
  note: string;
}

/** One museum_archive() row. */
export interface ArchiveExhibit {
  id: string;
  title: string;
  description: string;
  year: number;
  /** A recorded hall event, when it came from one. */
  event_key: string | null;
  /** The event as people say it ("Spring Hackathon 2024"); null when it came from no event. */
  event: string | null;
  track: string | null;
  award: ArchiveAward | null;
  team_name: string | null;
  tech: string[];
  project_url: string | null;
  github_url: string | null;
  video_url: string | null;
  cover_path: string | null;
  /** The makers who may be named, in order. */
  makers: ArchiveMaker[];
  /** Every maker slot, named or not. */
  team_size: number;
}

/** "The Archive" room in the Museum. */
export const ARCHIVE_ROOM = 'archive';
export const archiveRoomPath = () => `/museum?room=${ARCHIVE_ROOM}`;

/** The award as the Museum's awards read it (an archive exhibit's id stands for the project). */
export function archiveAward(a: ArchiveExhibit): Award | null {
  return a.award ? { place: a.award.place, name: a.award.name, track: a.award.track, note: a.award.note, project_id: a.id } : null;
}

/** The archive exhibit as a Museum exhibit: members linked on it stand in as its maker and
 *  collaborators, so the Collab wing and "Made by" work as for any project. */
export function archiveAsExhibit(a: ArchiveExhibit): Exhibit & { track: string | null } {
  const members = a.makers.filter((m): m is ArchiveMaker & { username: string } => Boolean(m.username));
  const [first, ...others] = members;
  return {
    project_id: a.id,
    username: first?.username ?? '',
    full_name: archiveCredit(a) ?? a.title,
    avatar_path: null,
    member_no: first?.member_no ?? 0,
    featured: false,
    console: null,
    track: a.track,
    project: {
      id: a.id,
      title: a.title,
      description: a.description || null,
      cover_path: a.cover_path,
      project_url: a.project_url,
      github_url: a.github_url,
      language: null,
      stars: null,
      tech_stack: a.tech,
      source: 'manual',
      project_date: String(a.year),
      collaborators: others.map((m) => ({ username: m.username, full_name: m.full_name ?? m.username, member_no: m.member_no ?? 0 })),
    },
    archive: a,
  };
}

/** How many makers aren't named on the exhibit. */
export const unnamed = (a: Pick<ArchiveExhibit, 'makers' | 'team_size'>) => Math.max(0, a.team_size - a.makers.length);

/** "Ada and Bo", "Ada and 2 more · Team Kite", "Team Kite", "a team of 4"; null when nobody is recorded. */
export function archiveCredit(a: Pick<ArchiveExhibit, 'makers' | 'team_size' | 'team_name'>): string | null {
  const names = a.makers.map((m) => m.full_name).filter((n): n is string => Boolean(n));
  const more = unnamed(a);
  const team = a.team_name?.trim() || null;
  if (names.length === 0) return team ?? (a.team_size > 1 ? `a team of ${a.team_size}` : a.team_size === 1 ? 'one maker' : null);
  const people = more > 0 ? `${names.join(', ')} and ${more} more` : names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return team ? `${people} · ${team}` : people;
}

/** "Spring Hackathon 2024 · Health track", "2023". */
export function archiveOrigin(a: Pick<ArchiveExhibit, 'event' | 'year' | 'track'>): string {
  return [a.event ?? String(a.year), a.track && `${a.track} track`].filter(Boolean).join(' · ');
}

/** The Archive room: exhibits by year, newest year first. */
export function byYear(items: readonly ArchiveExhibit[]): { year: number; items: ArchiveExhibit[] }[] {
  const years = [...new Set(items.map((a) => a.year))].sort((x, y) => y - x);
  return years.map((year) => ({ year, items: items.filter((a) => a.year === year).sort((x, y) => x.title.localeCompare(y.title)) }));
}

/** Each event room with the archive exhibits that came from that event: entries (by their track)
 *  and, when they won, their awards beside the ones announced in the hall. */
export function withArchive(events: readonly MuseumEvent[], archive: readonly ArchiveExhibit[]): MuseumEvent[] {
  return events.map((e) => {
    const mine = archive.filter((a) => a.event_key === e.key);
    if (mine.length === 0) return e;
    const entries: EventEntry[] = mine.map(archiveAsExhibit);
    const awards = mine.map(archiveAward).filter((a): a is Award => a !== null);
    return { ...e, entries: [...e.entries, ...entries], awards: [...e.awards, ...awards] };
  });
}

/** A trophy case in the Winners' Hall: one event (from the hall or the archive) and its winners. */
export interface TrophyCase {
  key: string;
  title: string;
  /** "Hackathon · 6–10 Oct" for hall events, "From the Archive" for older ones. */
  sub: string;
  /** A recorded event's Museum room, when it has one. */
  eventKey: string | null;
  year: number | null;
  /** Newest first. */
  sort: string;
  winners: { award: Award; entry: EventEntry }[];
}

/** Archive winners whose event has no room of its own (older events, plain events), one case per
 *  event, newest year first. */
export function archiveCases(archive: readonly ArchiveExhibit[], rooms: ReadonlySet<string>): TrophyCase[] {
  const cases = new Map<string, TrophyCase>();
  for (const a of archive) {
    const award = archiveAward(a);
    if (!award || !a.event || (a.event_key && rooms.has(a.event_key))) continue;
    const key = a.event_key ?? `${a.event}|${a.year}`;
    const c = cases.get(key) ?? { key, title: a.event, sub: 'From the Archive', eventKey: null, year: a.year, sort: `${a.year}-12-31`, winners: [] };
    c.winners.push({ award, entry: archiveAsExhibit(a) });
    cases.set(key, c);
  }
  return [...cases.values()].map((c) => ({ ...c, winners: [...c.winners].sort((x, y) => awardOrder(x.award, y.award)) })).sort((x, y) => y.sort.localeCompare(x.sort));
}

/** Parses museum_archive() rows, dropping anything malformed. */
export function parseArchive(rows: unknown): ArchiveExhibit[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Partial<ArchiveExhibit>;
    if (typeof o.id !== 'string' || typeof o.title !== 'string' || typeof o.year !== 'number') return [];
    return [
      {
        id: o.id,
        title: o.title,
        description: typeof o.description === 'string' ? o.description : '',
        year: o.year,
        event_key: o.event_key ?? null,
        event: o.event ?? null,
        track: o.track ?? null,
        award: o.award && typeof o.award === 'object' ? { place: o.award.place ?? null, name: o.award.name ?? null, track: o.award.track ?? null, note: o.award.note ?? '' } : null,
        team_name: o.team_name ?? null,
        tech: Array.isArray(o.tech) ? o.tech.filter((t): t is string => typeof t === 'string') : [],
        project_url: o.project_url ?? null,
        github_url: o.github_url ?? null,
        video_url: o.video_url ?? null,
        cover_path: o.cover_path ?? null,
        makers: Array.isArray(o.makers) ? o.makers.filter((m) => m && typeof m === 'object') : [],
        team_size: Number(o.team_size ?? 0) || 0,
      },
    ];
  });
}
