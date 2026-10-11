// Museum wings (V2-6, D-102). A wing is a name, an admin's curator note and a rule; which exhibits
// hang in it is worked out here from the exhibits themselves, so a wing never claims a project
// that doesn't fit it. Empty wings are not shown (product rule 7). No wing is behind PIPs. In the
// walkable Museum (V2-11) each wing is a room with a style an admin picks.

import type { Exhibit } from '../types/museum';

export type WingKind = 'featured' | 'collab' | 'tags' | 'officers';

/** What a wing's rule needs to know beyond the exhibit: who the current officers are (D-123). */
export interface WingContext {
  officers?: ReadonlySet<string>;
  /** Exhibits the admins hung in a wing by hand (D-133), by wing key, in their order. */
  picks?: ReadonlyMap<string, readonly string[]>;
}

export interface Wing {
  key: string;
  kind: WingKind;
  name: string;
  /** The curator's note; empty until an admin writes one. */
  note: string;
  tags: string[];
  /** How the wing's room looks in the walkable Museum (V2-11, D-125); missing before that update. */
  style?: RoomStyle;
}

/** The room styles of the walkable Museum (V2-11, D-125): original presets, looks only. */
export type RoomStyle = 'arcade' | 'lab' | 'library' | 'garden' | 'trophy';
export const ROOM_STYLES: readonly { value: RoomStyle; label: string }[] = [
  { value: 'arcade', label: 'Arcade' },
  { value: 'lab', label: 'Lab' },
  { value: 'library', label: 'Library' },
  { value: 'garden', label: 'Garden' },
  { value: 'trophy', label: 'Trophy room' },
];
const isStyle = (s: unknown): s is RoomStyle => ROOM_STYLES.some((r) => r.value === s);

/** A wing's room style: its own, else the one the walk migration starts it in. */
export function wingStyle(w: Pick<Wing, 'key' | 'kind' | 'style'>): RoomStyle {
  if (w.style && isStyle(w.style)) return w.style;
  if (w.kind === 'featured') return 'garden';
  if (w.kind === 'collab') return 'lab';
  if (w.kind === 'officers') return 'library';
  return w.key === 'web' ? 'garden' : w.key === 'data' ? 'lab' : 'arcade';
}

/** The wings before an admin changes anything (mirrors the seed in the wings migration). Used by
 *  sample-data halls and before the database update; these have no notes, as nobody wrote any. */
export const DEFAULT_WINGS: readonly Wing[] = [
  { key: 'featured', kind: 'featured', name: 'Featured Wing', note: '', tags: [], style: 'garden' },
  { key: 'collab', kind: 'collab', name: 'Collab Wing', note: '', tags: [], style: 'lab' },
  { key: 'officers', kind: 'officers', name: 'Officers’ Wing', note: '', tags: [], style: 'library' },
  { key: 'web', kind: 'tags', name: 'Web Wing', note: '', tags: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue', 'Svelte', 'Next.js', 'PWA', 'Node.js'], style: 'garden' },
  { key: 'games', kind: 'tags', name: 'Games Wing', note: '', tags: ['Unity', 'Godot', 'C#', 'Phaser', 'Pygame', 'Game', 'Lua', 'GDScript'], style: 'arcade' },
  { key: 'data', kind: 'tags', name: 'Data Wing', note: '', tags: ['Python', 'SQL', 'Postgres', 'Pandas', 'Jupyter', 'R', 'Machine Learning', 'Data'], style: 'lab' },
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
  const byId = new Map(exhibits.map((e) => [e.project_id, e]));
  return wings
    .map((wing) => {
      // The admins' picks first, in their order (D-133), then what the wing's rule brings in.
      const picked = (ctx.picks?.get(wing.key) ?? []).flatMap((id) => byId.get(id) ?? []);
      const ids = new Set(picked.map((e) => e.project_id));
      return { wing, exhibits: [...picked, ...exhibits.filter((e) => !ids.has(e.project_id) && inWing(e, wing, ctx))] };
    })
    .filter((r) => r.exhibits.length > 0);
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

/** What puts an exhibit in the wing, in visitors' words. */
export function wingRule(w: Pick<Wing, 'kind' | 'tags'>): string {
  if (w.kind === 'featured') return 'Exhibits by members the curators featured.';
  if (w.kind === 'collab') return 'Projects made by more than one member of the hall.';
  if (w.kind === 'officers') return 'Projects by the hall’s current officers, as named by its admins.';
  if (w.tags.length === 0) return 'Exhibits the curators picked for this wing.';
  return `Projects built with ${w.tags.slice(0, 6).join(', ')}${w.tags.length > 6 ? '…' : ''}.`;
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
    return [
      {
        key: o.key,
        kind: o.kind as WingKind,
        name: o.name,
        note: typeof o.note === 'string' ? o.note : '',
        tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
        ...(isStyle(o.style) ? { style: o.style } : {}),
      },
    ];
  });
}
