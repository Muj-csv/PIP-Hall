import { describe, expect, it } from 'vitest';
import samples from '../data/sample-cards.json';
import type { PublicCard } from '../types/card';
import type { Exhibit } from '../types/museum';
import { EMPTY_PASSPORT, missingFrom, parsePassport, passportPages, stamp, teamProjects } from './passport';
import { NO_FILTERS, whyPicked } from './search';

const cards = (samples as unknown as PublicCard[]).map((c) => ({ ...c, no: c.member_no }));
const [p1, p2, p3] = cards as [PublicCard, PublicCard, PublicCard];
const exhibits: Exhibit[] = cards.flatMap((c) =>
  c.card.projects.map((p, i) => ({ project_id: `${c.username}-${i}`, username: c.username, full_name: c.card.full_name, avatar_path: null, member_no: c.member_no, project: p })),
);

describe('passport (V2-2)', () => {
  it('stamps once per person or exhibit', () => {
    const a = stamp(EMPTY_PASSPORT, 'people', p1.profile_id, '2026-10-06T01:00:00Z');
    expect(stamp(a, 'people', p1.profile_id)).toBe(a);
    expect(stamp(a, 'exhibits', 'x').exhibits).toHaveLength(1);
  });

  it('reads a stored passport defensively', () => {
    expect(parsePassport(null)).toEqual(EMPTY_PASSPORT);
    expect(parsePassport({ people: [{ id: 'a', at: 'nope' }, { id: 'b', at: '2026-10-06T00:00:00Z', extra: 1 }, 'x'], exhibits: 'no' })).toEqual({
      people: [{ id: 'b', at: '2026-10-06T00:00:00Z' }],
      exhibits: [],
    });
  });

  it('only shows people and exhibits that are really in the hall, and never yourself', () => {
    let d = stamp(EMPTY_PASSPORT, 'people', p2.profile_id);
    d = stamp(d, 'people', 'someone-who-left');
    d = stamp(d, 'people', p1.profile_id); // me
    d = stamp(d, 'exhibits', 'sample-player-2-0');
    d = stamp(d, 'exhibits', 'gone');
    const pages = passportPages(d, cards, exhibits, p1.profile_id);
    expect(pages.people.map((p) => p.card.username)).toEqual(['sample-player-2']);
    expect(pages.peopleTotal).toBe(cards.length - 1);
    expect(pages.exhibits.map((e) => e.exhibit.project_id)).toEqual(['sample-player-2-0']);
    expect(pages.exhibitsTotal).toBe(exhibits.filter((e) => e.username !== p1.username).length);
    expect(passportPages(d, cards, null).exhibitsTotal).toBeNull();
  });

  it('collects the skills of the people you met, each once', () => {
    const pages = passportPages(stamp(stamp(EMPTY_PASSPORT, 'people', p1.profile_id), 'people', p3.profile_id), cards, null);
    const names = pages.skills.map((s) => s.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(pages.skills.length).toBeGreaterThan(0);
    expect(pages.skills.length).toBeLessThanOrEqual(pages.skillsTotal);
  });

  it('finds a collaboration once you have met every maker', () => {
    const teams = teamProjects(cards);
    expect(teams.map((t) => t.project.title)).toEqual(['Sample Quest One']); // fixture: player 1 with player 2
    const one = stamp(EMPTY_PASSPORT, 'people', p1.profile_id);
    expect(passportPages(one, cards, null).collaborations).toHaveLength(0);
    expect(passportPages(stamp(one, 'people', p2.profile_id), cards, null).collaborations).toHaveLength(1);
    // As player 2 you only need to meet player 1.
    expect(passportPages(one, cards, null, p2.profile_id).collaborations).toHaveLength(1);
  });

  it('knows which device stamps an account is missing', () => {
    const device = stamp(stamp(EMPTY_PASSPORT, 'people', 'a'), 'people', 'b');
    expect(missingFrom(device, stamp(EMPTY_PASSPORT, 'people', 'a')).people.map((s) => s.id)).toEqual(['b']);
  });
});

describe('why Pip picked (V2-2)', () => {
  it('explains each word of a search from the card itself', () => {
    expect(whyPicked(p1, NO_FILTERS)).toEqual([]);
    const why = whyPicked(p1, { ...NO_FILTERS, q: 'postgres sample' });
    expect(why[0]).toMatch(/^Lists Postgres in their skills$/i);
    expect(why).toContain('Name or handle matches “sample”');
  });

  it('explains filters too, and never invents a reason', () => {
    const why = whyPicked(p1, { ...NO_FILTERS, skill: 'TypeScript', featured: true });
    expect(why).toContain('Lists TypeScript in their skills');
    expect(why).toContain('Featured by the hall');
    expect(whyPicked(p1, { ...NO_FILTERS, q: 'zzzz' })).toEqual([]);
  });
});
