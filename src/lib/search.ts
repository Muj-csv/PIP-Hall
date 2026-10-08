// Search for /explore (FR-13). The whole public collection is small (≈ 2–3 KB a card), so it is
// loaded once and filtered in memory: one normalized haystack per card, every word must match.

import type { PublicCard } from '../types/card';
import { officerLabel, type Officer } from './officers';

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
  /** The Officers door (V2-10b, D-123): only the current officers, in their team's order. */
  officers?: boolean;
}

export const NO_FILTERS: Filters = { q: '', department: null, skill: null, featured: false, officers: false };

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

/** Cards matching every filter, best matches first (then by member number). Through the Officers
 *  door, the current officers only, in their seats unless a search ranks them. */
export function search(index: Indexed[], f: Filters, officers: ReadonlyMap<string, Officer> = new Map()): PublicCard[] {
  const words = normalize(f.q).split(' ').filter(Boolean);
  const dept = f.department ? normalize(f.department) : null;
  const skill = f.skill ? normalize(f.skill) : null;
  const hits: { card: PublicCard; score: number }[] = [];
  for (const i of index) {
    if (f.officers && !officers.has(i.card.profile_id)) continue;
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
  const seat = (c: PublicCard) => (f.officers ? (officers.get(c.profile_id)?.seat ?? 100) : 0);
  return hits.sort((a, b) => b.score - a.score || seat(a.card) - seat(b.card) || a.card.no - b.card.no).map((h) => h.card);
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

/** Filters <-> URL query (?q=&dept=&skill=&featured=1&officers=1), so a search can be shared. */
export function filtersFromParams(p: URLSearchParams): Filters {
  return { q: p.get('q') ?? '', department: p.get('dept') || null, skill: p.get('skill') || null, featured: p.get('featured') === '1', officers: p.get('officers') === '1' };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q);
  if (f.department) p.set('dept', f.department);
  if (f.skill) p.set('skill', f.skill);
  if (f.featured) p.set('featured', '1');
  if (f.officers) p.set('officers', '1');
  return p;
}

export function isFiltered(f: Filters): boolean {
  return Boolean(f.q.trim() || f.department || f.skill || f.featured || f.officers);
}

/**
 * Why a card matched (V2-2 "Why Pip picked"): one plain line per reason, from the card's own
 * published data. Empty when nothing is filtered. No scores, no guesses.
 */
export function whyPicked(card: PublicCard, f: Filters, officer: Officer | null = null): string[] {
  const c = card.card;
  const reasons: string[] = [];
  const add = (r: string) => {
    if (!reasons.includes(r)) reasons.push(r);
  };
  if (f.officers && officer) add(`${officerLabel(officer)}, named by the hall’s admins`);
  const has = (text: string | null | undefined, w: string) => Boolean(text && normalize(text).includes(w));
  for (const w of normalize(f.q).split(' ').filter(Boolean)) {
    const skill = (c.skills ?? []).find((s) => has(s, w));
    const titled = c.projects.find((p) => has(p.title, w));
    const built = c.projects.find((p) => has(p.language, w) || p.tech_stack.some((t) => has(t, w)));
    if (has(c.full_name, w) || has(c.username, w) || has(c.github_username, w)) add(`Name or handle matches “${w}”`);
    else if (skill) add(`Lists ${skill} in their skills`);
    else if (titled) add(`Made ${titled.title}`);
    else if (built) add(`Built ${built.title} with ${[built.language, ...built.tech_stack].find((t) => has(t, w)) ?? w}`);
    else if (has(c.role, w) || has(c.org_position, w)) add(`Role: ${[c.role, c.org_position].filter(Boolean).join(' · ')}`);
    else if (has(c.department, w)) add(`In ${c.department}`);
    else if (has(c.tagline, w)) add(`Tagline mentions “${w}”`);
    else if (c.projects.some((p) => has(p.description, w))) add(`A project mentions “${w}”`);
    else if (has(c.bio, w)) add(`Bio mentions “${w}”`);
  }
  if (f.skill) add(`Lists ${(c.skills ?? []).find((s) => normalize(s) === normalize(f.skill!)) ?? f.skill} in their skills`);
  if (f.department) add(`In ${c.department ?? f.department}`);
  if (f.featured) add('Featured by the hall');
  if (reasons.length && c.github_username && c.projects.some((p) => p.source === 'github')) add('Projects verified on GitHub');
  return reasons;
}
