// Museum wings (V2-6, D-102). A wing is a name, an admin's curator note and a rule; which exhibits
// hang in it is worked out here from the exhibits themselves, so a wing never claims a project
// that doesn't fit it. Empty wings are not shown (product rule 7). No wing is behind PIPs.

import type { Exhibit } from '../types/museum';

export type WingKind = 'featured' | 'collab' | 'tags' | 'officers';

/** What a wing's rule needs to know beyond the exhibit: who the current officers are (D-123). */
export interface WingContext {
  officers?: ReadonlySet<string>;
}

export interface Wing {
  key: string;
  kind: WingKind;
  name: string;
  /** The curator's note; empty until an admin writes one. */
  note: string;
  tags: string[];
}

/** The wings before an admin changes anything (mirrors the seed in the wings migration). Used by
 *  sample-data halls and before the database update; these have no notes, as nobody wrote any. */
export const DEFAULT_WINGS: readonly Wing[] = [
  { key: 'featured', kind: 'featured', name: 'Featured Wing', note: '', tags: [] },
  { key: 'collab', kind: 'collab', name: 'Collab Wing', note: '', tags: [] },
  { key: 'officers', kind: 'officers', name: 'Officers’ Wing', note: '', tags: [] },
  { key: 'web', kind: 'tags', name: 'Web Wing', note: '', tags: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue', 'Svelte', 'Next.js', 'PWA', 'Node.js'] },
  { key: 'games', kind: 'tags', name: 'Games Wing', note: '', tags: ['Unity', 'Godot', 'C#', 'Phaser', 'Pygame', 'Game', 'Lua', 'GDScript'] },
  { key: 'data', kind: 'tags', name: 'Data Wing', note: '', tags: ['Python', 'SQL', 'Postgres', 'Pandas', 'Jupyter', 'R', 'Machine Learning', 'Data'] },
];

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Does this exhibit hang in this wing? */
export function inWing(e: Exhibit, w: Wing, ctx: WingContext = {}): boolean {
  switch (w.kind) {
    case 'featured':
      return Boolean(e.featured);
    case 'collab':
      return (e.project.collaborators?.length ?? 0) > 0;
    case 'officers': {
      // Made by a current officer: its maker, or a member credited on it.
      const officers = ctx.officers ?? new Set<string>();
      return officers.has(e.username) || (e.project.collaborators ?? []).some((c) => officers.has(c.username));
    }
    case 'tags': {
      const tags = new Set(w.tags.map(norm));
      return [e.project.language, ...e.project.tech_stack].some((t) => tags.has(norm(t)));
    }
  }
}

export interface WingRoom {
  wing: Wing;
  exhibits: Exhibit[];
}

/** The wings that have something on show, in the curators' order, each with its exhibits. */
export function wingRooms(wings: readonly Wing[], exhibits: readonly Exhibit[], ctx: WingContext = {}): WingRoom[] {
  return wings.map((wing) => ({ wing, exhibits: exhibits.filter((e) => inWing(e, wing, ctx)) })).filter((r) => r.exhibits.length > 0);
}

/** The wings an exhibit hangs in, and up to `n` other exhibits from them, for "more like this". */
export function relatedTo(e: Exhibit, wings: readonly Wing[], exhibits: readonly Exhibit[], n = 4, ctx: WingContext = {}): { wings: Wing[]; related: Exhibit[] } {
  const mine = wings.filter((w) => inWing(e, w, ctx));
  const seen = new Set([e.project_id]);
  const related: Exhibit[] = [];
  for (const w of mine) {
    for (const x of exhibits) {
      if (related.length >= n) break;
      if (!seen.has(x.project_id) && inWing(x, w, ctx)) {
        seen.add(x.project_id);
        related.push(x);
      }
    }
  }
  return { wings: mine, related };
}

/** The address of a wing's room in the Museum. */
export function wingPath(key: string): string {
  return `/museum?wing=${encodeURIComponent(key)}`;
}

/** Parses museum_wings() rows, dropping anything malformed. */
export function parseWings(rows: unknown): Wing[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Partial<Wing>;
    if (typeof o.key !== 'string' || typeof o.name !== 'string' || !['featured', 'collab', 'tags', 'officers'].includes(o.kind as string)) return [];
    return [{ key: o.key, kind: o.kind as WingKind, name: o.name, note: typeof o.note === 'string' ? o.note : '', tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [] }];
  });
}
