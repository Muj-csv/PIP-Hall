import { describe, expect, it } from 'vitest';
import type { PublicProject } from '../types/card';
import type { Exhibit } from '../types/museum';
import { DEFAULT_WINGS, inWing, parseWings, relatedTo, wingPath, wingRooms, type Wing } from './wings';

const exhibit = (id: string, over: Partial<PublicProject> = {}, featured = false): Exhibit => ({
  project_id: id,
  username: `u-${id}`,
  full_name: `Maker ${id}`,
  avatar_path: null,
  member_no: 1,
  featured,
  project: { title: `P ${id}`, description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], source: 'manual', project_date: null, ...over },
});
const wing = (key: string): Wing => DEFAULT_WINGS.find((w) => w.key === key)!;

describe('wings', () => {
  const web = exhibit('a', { language: 'typescript', tech_stack: ['React'] });
  const data = exhibit('b', { language: 'Python' });
  const team = exhibit('c', { language: 'Lua', collaborators: [{ username: 'x', full_name: 'X', member_no: 2 }] }, true);
  const none = exhibit('d', { language: 'COBOL' });
  const all = [web, data, team, none];

  it('places an exhibit by its own language and tools (ignoring case)', () => {
    expect(inWing(web, wing('web'))).toBe(true);
    expect(inWing(data, wing('data'))).toBe(true);
    expect(inWing(data, wing('web'))).toBe(false);
    expect(inWing(team, wing('games'))).toBe(true);
  });

  it('fills the Featured and Collab wings from the facts, not tags', () => {
    expect(inWing(team, wing('featured'))).toBe(true);
    expect(inWing(team, wing('collab'))).toBe(true);
    expect(inWing(web, wing('featured'))).toBe(false);
  });

  it('fills the Officers’ Wing with exhibits made or co-made by a current officer', () => {
    expect(inWing(team, wing('officers'))).toBe(false);
    expect(inWing(team, wing('officers'), { officers: new Set(['x']) })).toBe(true);
    expect(inWing(web, wing('officers'), { officers: new Set(['x']) })).toBe(false);
    expect(inWing(web, wing('officers'), { officers: new Set([web.username]) })).toBe(true);
  });

  it('shows only wings with something on show, in the curators’ order', () => {
    expect(wingRooms(DEFAULT_WINGS, all).map((r) => [r.wing.key, r.exhibits.length])).toEqual([
      ['featured', 1],
      ['collab', 1],
      ['web', 1],
      ['games', 1],
      ['data', 1],
    ]);
    expect(wingRooms(DEFAULT_WINGS, [none])).toEqual([]);
  });

  it('leads from an exhibit to others in its wings, never to itself', () => {
    const more = exhibit('e', { tech_stack: ['Svelte'] });
    const r = relatedTo(web, DEFAULT_WINGS, [...all, more]);
    expect(r.wings.map((w) => w.key)).toEqual(['web']);
    expect(r.related.map((x) => x.project_id)).toEqual(['e']);
    expect(relatedTo(none, DEFAULT_WINGS, all)).toEqual({ wings: [], related: [] });
  });

  it('reads database rows safely and links to each room', () => {
    expect(parseWings([{ key: 'web', kind: 'tags', name: 'Web', note: 'Hi', tags: ['JS', 3] }, { key: 'x', kind: 'nope', name: 'X' }, null])).toEqual([
      { key: 'web', kind: 'tags', name: 'Web', note: 'Hi', tags: ['JS'] },
    ]);
    expect(parseWings('nope')).toEqual([]);
    expect(wingPath('web')).toBe('/museum?wing=web');
    // Seeded wings have no notes: the words are the curators'.
    expect(DEFAULT_WINGS.every((w) => w.note === '')).toBe(true);
  });
});
