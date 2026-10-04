import { describe, expect, it } from 'vitest';
import samples from '../data/sample-cards.json';
import { numberCards } from '../services/cardService';
import type { PublishedCardRow } from '../types/card';
import { facets, filtersFromParams, filtersToParams, indexCards, normalize, NO_FILTERS, randomCard, search } from './search';

const cards = numberCards(samples as PublishedCardRow[]);
const base = cards[0]!;
const make = (no: number, over: Partial<typeof base.card>, featured = false) => ({
  ...base,
  profile_id: `p${no}`,
  username: over.username ?? `user${no}`,
  member_no: no,
  no,
  is_featured: featured,
  card: { ...base.card, username: `user${no}`, full_name: `User ${no}`, role: null, department: null, tagline: null, bio: null, skills: [], projects: [], github_username: null, ...over, is_featured: featured },
});
const project = (title: string, language: string | null = null) => ({ title, description: null, cover_path: null, project_url: null, github_url: null, language, stars: null, tech_stack: [], source: 'manual' as const, project_date: null });

const roster = [
  make(1, { full_name: 'José Rizal', username: 'jose', role: 'Writer', department: 'Design', skills: ['Figma', 'Writing'] }),
  make(2, { full_name: 'Ana Cruz', username: 'anacruz', role: 'Backend dev', department: 'Engineering', skills: ['Go', 'Postgres'], projects: [project('Tide Tables', 'Rust')] }, true),
  make(3, { full_name: 'Ben Ong', username: 'ben-o', department: 'engineering', skills: ['figma'], bio: 'Draws maps for Jose.' }),
];
const idx = indexCards(roster);
const names = (f: Partial<typeof NO_FILTERS>) => search(idx, { ...NO_FILTERS, ...f }).map((c) => c.username);

describe('normalize', () => {
  it('folds accents and case and keeps handle characters', () => {
    expect(normalize('  José  RIZAL ')).toBe('jose rizal');
    expect(normalize('@ben-o C#')).toBe('@ben-o c#');
  });
});

describe('search (Phase 5 acceptance: name, handle, skill, project title)', () => {
  it('finds by name, accent-insensitive', () => expect(names({ q: 'jose' })).toEqual(['jose', 'ben-o']));
  it('ranks a name match above a bio mention', () => expect(names({ q: 'jose' })[0]).toBe('jose'));
  it('finds by handle with or without @', () => {
    expect(names({ q: 'anacruz' })).toEqual(['anacruz']);
    expect(names({ q: '@ben-o' })).toEqual(['ben-o']);
  });
  it('finds by skill', () => expect(names({ q: 'postgres' })).toEqual(['anacruz']));
  it('finds by project title and language', () => {
    expect(names({ q: 'tide tables' })).toEqual(['anacruz']);
    expect(names({ q: 'rust' })).toEqual(['anacruz']);
  });
  it('needs every word to match', () => expect(names({ q: 'ana figma' })).toEqual([]));
  it('an empty query lists everyone in member order', () => expect(names({})).toEqual(['jose', 'anacruz', 'ben-o']));
  it('filters by department, ignoring case', () => expect(names({ department: 'Engineering' })).toEqual(['anacruz', 'ben-o']));
  it('filters by skill, ignoring case', () => expect(names({ skill: 'Figma' })).toEqual(['jose', 'ben-o']));
  it('filters featured', () => expect(names({ featured: true })).toEqual(['anacruz']));
  it('combines filters and words', () => expect(names({ department: 'engineering', q: 'ben' })).toEqual(['ben-o']));
});

describe('facets', () => {
  it('merges case variants and counts, most common first', () => {
    const f = facets(roster);
    expect(f.departments).toEqual([{ value: 'Engineering', count: 2 }, { value: 'Design', count: 1 }]);
    expect(f.skills[0]).toEqual({ value: 'Figma', count: 2 });
  });
  it('works on the sample data', () => expect(facets(cards).skills.length).toBeGreaterThan(0));
});

describe('randomCard', () => {
  it('picks within range and handles empty lists', () => {
    expect(randomCard(roster, () => 0)?.username).toBe('jose');
    expect(randomCard(roster, () => 0.9999)?.username).toBe('ben-o');
    expect(randomCard([], () => 0.5)).toBeNull();
  });
});

describe('URL round trip', () => {
  it('keeps every filter', () => {
    const f = { q: 'figma', department: 'Design', skill: 'Go', featured: true };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersToParams(NO_FILTERS).toString()).toBe('');
  });
});
