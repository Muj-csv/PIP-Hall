// The officers' space (V2-10b, D-123). Admins name each term's officers (an affiliation marked as an
// officers' team, with positions and seats); the database lists them (hall_officers()). This file
// turns that list into words and lookups for the hall's Officers door, the Officers' Wing, the
// officer pin on badges and the profile. Team names are the admins' words (D-067).

export interface Officer {
  profile_id: string;
  username: string;
  full_name: string;
  position: string | null;
  /** The order the team is shown in (1 first). */
  seat: number;
  /** The team, as the admins named it ("Officers 2026–27"). */
  team: string;
  team_key: string;
  /** YYYY-MM-DD, or null while the term has no end set. */
  term_ends: string | null;
  current: boolean;
}

/** "President · Officers 2026–27"; the team alone when no position is set. */
export const officerLabel = (o: Pick<Officer, 'position' | 'team'>) => (o.position ? `${o.position} · ${o.team}` : o.team);

/** Each current officer by member id (their first seat, if on two teams). */
export function currentByMember(list: readonly Officer[]): Map<string, Officer> {
  const out = new Map<string, Officer>();
  for (const o of list) if (o.current && !out.has(o.profile_id)) out.set(o.profile_id, o);
  return out;
}

/** The current officers in their seats, team by team. */
export const currentOfficers = (list: readonly Officer[]) => list.filter((o) => o.current);

/** Usernames of the current officers (for the Officers' Wing). */
export const officerUsernames = (list: readonly Officer[]) => new Set(currentOfficers(list).map((o) => o.username));

/** Parses hall_officers() rows, dropping anything malformed. */
export function parseOfficers(rows: unknown): Officer[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Partial<Officer>;
    if (typeof o.profile_id !== 'string' || typeof o.username !== 'string' || typeof o.team !== 'string') return [];
    return [
      {
        profile_id: o.profile_id,
        username: o.username,
        full_name: typeof o.full_name === 'string' ? o.full_name : o.username,
        position: typeof o.position === 'string' && o.position ? o.position : null,
        seat: Number(o.seat ?? 100) || 100,
        team: o.team,
        team_key: String(o.team_key ?? ''),
        term_ends: o.term_ends ?? null,
        current: o.current !== false,
      },
    ];
  });
}
