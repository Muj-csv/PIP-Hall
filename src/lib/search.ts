// Search for /explore (FR-13). The whole public collection is small (≈ 2–3 KB a card), so it is
// loaded once and filtered in memory: one normalized haystack per card, every word must match.

import type { PublicCard } from '../types/card';

/** Lowercase, accents folded (José → jose), punctuation and runs of space collapsed. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.@_-]+/g, ' ')
    .trim();
}

export interface Filters {
  q: string;
  department: string | null;
  skill: string | null;
  featured: boolean;
}

export const NO_FILTERS: Filters = { q: '', department: null, skill: null, featured: false };

interface Indexed {
  card: PublicCard;
  /** Name and handle: a match here ranks first. */
  primary: string;
  /** Role, position, department, tagline, skills. */
  secondary: string;
  /** Bio, projects, languages, tech stack. */
  rest: string;
  department: string | null;
  skills: Set<string>;
}

export function indexCards(cards: PublicCard[]): Indexed[] {
  return cards.map((card) => {
    const c = card.card;
    const projects = c.projects.flatMap((p) => [p.title, p.description ?? '', p.language ?? '', ...p.tech_stack]);
    return {
      card,
      primary: normalize([c.full_name, c.username, `@${c.username}`, c.github_username ?? ''].join(' ')),
      secondary: normalize([c.role, c.org_position, c.department, c.tagline, ...c.skills].filter(Boolean).join(' ')),
      rest: normalize([c.bio ?? '', ...projects].join(' ')),
      department: c.department ? normalize(c.department) : null,
      skills: new Set(c.skills.map(normalize)),
    };
  });
}

/** Cards matching every filter, best matches first (then by member number). */
export function search(index: Indexed[], f: Filters): PublicCard[] {
  const words = normalize(f.q).split(' ').filter(Boolean);
  const dept = f.department ? normalize(f.department) : null;
  const skill = f.skill ? normalize(f.skill) : null;
  const hits: { card: PublicCard; score: number }[] = [];
  for (const i of index) {
    if (f.featured && !i.card.is_featured) continue;
    if (dept && i.department !== dept) continue;
    if (skill && !i.skills.has(skill)) continue;
    let score = 0;
    let all = true;
    for (const w of words) {
      const s = i.primary.includes(w) ? 3 : i.secondary.includes(w) ? 2 : i.rest.includes(w) ? 1 : 0;
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) hits.push({ card: i.card, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.card.no - b.card.no).map((h) => h.card);
}

export interface Facet {
  value: string;
  count: number;
}

/** Departments and skills to offer as filter chips, most common first (ties alphabetical). */
export function facets(cards: PublicCard[], maxSkills = 12): { departments: Facet[]; skills: Facet[] } {
  const count = (values: string[]) => {
    const m = new Map<string, Facet>();
    for (const v of values) {
      const key = normalize(v);
      if (!key) continue;
      const f = m.get(key);
      if (f) f.count += 1;
      else m.set(key, { value: v.trim(), count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };
  return {
    departments: count(cards.flatMap((c) => (c.card.department ? [c.card.department] : []))),
    skills: count(cards.flatMap((c) => c.card.skills)).slice(0, maxSkills),
  };
}

/** One card at random, or null for an empty list. `rand` is injectable for tests. */
export function randomCard(cards: PublicCard[], rand: () => number = Math.random): PublicCard | null {
  if (!cards.length) return null;
  return cards[Math.min(cards.length - 1, Math.floor(rand() * cards.length))] ?? null;
}

/** Filters <-> URL query (?q=&dept=&skill=&featured=1), so a search can be shared. */
export function filtersFromParams(p: URLSearchParams): Filters {
  return { q: p.get('q') ?? '', department: p.get('dept') || null, skill: p.get('skill') || null, featured: p.get('featured') === '1' };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  if (f.department) p.set('dept', f.department);
  if (f.skill) p.set('skill', f.skill);
  if (f.featured) p.set('featured', '1');
  return p;
}

export function isFiltered(f: Filters): boolean {
  return Boolean(f.q.trim() || f.department || f.skill || f.featured);
}
