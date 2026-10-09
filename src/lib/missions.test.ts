import { describe, expect, it } from 'vitest';
import samples from '../data/sample-cards.json';
import type { PublicCard } from '../types/card';
import type { Exhibit } from '../types/museum';
import { makeMission, missionKey, missionMet, missionPeriod, pickMissions } from './missions';
import { EMPTY_PASSPORT, stamp } from './passport';

const cards = (samples as unknown as PublicCard[]).map((c) => ({ ...c, no: c.member_no }));
const exhibits: Exhibit[] = cards.flatMap((c) =>
  c.card.projects.map((p, i) => ({ project_id: `${c.username}-${i}`, username: c.username, full_name: c.card.full_name, avatar_path: null, member_no: c.member_no, project: p })),
);

describe('missions (V2-3)', () => {
  it('uses the hall’s calendar: Manila days and ISO weeks starting Monday', () => {
    // 2026-10-06 23:30 UTC is already Wednesday 7 Oct in Manila.
    const now = new Date('2026-10-06T23:30:00Z');
    expect(missionPeriod('daily', now)).toEqual({ label: '2026-10-07', starts: new Date('2026-10-06T16:00:00Z') });
    expect(missionPeriod('weekly', now)).toEqual({ label: '2026-W41', starts: new Date('2026-10-04T16:00:00Z') }); // Mon 5 Oct, Manila
    expect(missionPeriod('weekly', new Date('2027-01-01T04:00:00Z')).label).toBe('2026-W53');
  });

  it('keys match the database (scope:period:kind:param:n, param lower-cased)', () => {
    expect(missionKey('daily', '2026-10-07', 'skill', ' Python ', 1)).toBe('daily:2026-10-07:skill:python:1');
    expect(missionKey('weekly', '2026-W41', 'people', null, 8)).toBe('weekly:2026-W41:people::8');
  });

  it('picks the same Missions for the same day, and only ones the hall can complete', () => {
    const a = pickMissions('2026-10-07', '2026-W41', cards, exhibits);
    expect(pickMissions('2026-10-07', '2026-W41', cards, exhibits)).toEqual(a);
    // A member's reroll (V2-5) seeds a fresh daily set, the same for that reroll every time; the
    // weekly Mission doesn't change.
    const keys = (x: typeof a) => x.daily.map((m) => m.key).join();
    const r1 = pickMissions('2026-10-07', '2026-W41', cards, exhibits, null, 1);
    expect(keys(r1)).not.toBe(keys(a));
    expect(pickMissions('2026-10-07', '2026-W41', cards, exhibits, null, 1)).toEqual(r1);
    expect(r1.weekly).toEqual(a.weekly);
    expect(a.daily).toHaveLength(3);
    expect(new Set(a.daily.map((m) => m.kind)).size).toBe(3);
    const skills = new Set(cards.flatMap((c) => (c.card.skills ?? []).map((s) => s.toLowerCase())));
    for (const m of a.daily) if (m.kind === 'skill') expect(skills.has(m.param!.toLowerCase())).toBe(true);
    expect(a.weekly?.kind).toBe('exhibits'); // 13 sample exhibits; six players is too few for "meet 8"
    expect(pickMissions('2026-10-07', '2026-W41', [], []).daily).toEqual([]);
    const days = new Set(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((d) => pickMissions(d, 'w', cards, exhibits).daily.map((m) => m.key.split(':').slice(2).join(':')).join()));
    expect(days.size).toBeGreaterThan(1); // the days differ
  });

  it('counts only stamps made in the period, and never imported ones', () => {
    const since = new Date('2026-10-06T16:00:00Z');
    const people = pickMissions('d', 'w', cards, exhibits).daily.find((m) => m.kind === 'people') ?? { scope: 'daily', kind: 'people', param: null, n: 3, key: 'k', title: '', action: { random: true } } as const;
    let p = EMPTY_PASSPORT;
    p = stamp(p, 'people', cards[1]!.profile_id, '2026-10-06T15:00:00Z'); // yesterday in Manila
    p = stamp(p, 'people', cards[2]!.profile_id, '2026-10-06T17:00:00Z');
    p = stamp(p, 'people', cards[3]!.profile_id, '2026-10-06T18:00:00Z');
    expect(missionMet(people, p, cards, since)).toBe(false);
    p = { ...p, people: [...p.people, { id: cards[4]!.profile_id, at: '2026-10-06T19:00:00Z', imported: true }] };
    expect(missionMet(people, p, cards, since)).toBe(false);
    p = stamp(p, 'people', cards[5]!.profile_id, '2026-10-06T20:00:00Z');
    expect(missionMet(people, p, cards, since)).toBe(true);
  });

  it('checks skill, team and tech Missions against the people met', () => {
    const since = new Date(0);
    const mk = (kind: 'skill' | 'team' | 'tech', param: string | null) => ({ scope: 'daily', kind, param, n: 1, key: '', title: '', action: { random: true } }) as const;
    const met1 = stamp(EMPTY_PASSPORT, 'people', cards[0]!.profile_id, '2026-10-06T20:00:00Z');
    expect(missionMet(mk('skill', 'postgres'), met1, cards, since)).toBe(true);
    expect(missionMet(mk('skill', 'cobol'), met1, cards, since)).toBe(false);
    expect(missionMet(mk('team', null), met1, cards, since)).toBe(true); // player 1 made Sample Quest One with player 2
    expect(missionMet(mk('tech', 'typescript'), met1, cards, since)).toBe(true);
  });

  it('V2-13: a project made by 3 or more people, a winning exhibit, 3 people who know a skill', () => {
    const since = new Date('2026-10-06T00:00:00Z');
    // Three members who all know Rust; the first made Raft with the other two.
    const base = cards[0]!;
    const member = (i: number): PublicCard => ({
      ...base,
      profile_id: `g${i}`,
      username: `gap${i}`,
      member_no: 100 + i,
      no: 100 + i,
      card: {
        ...base.card,
        username: `gap${i}`,
        full_name: `Gap ${i}`,
        skills: ['Rust'],
        projects:
          i === 1
            ? [{ ...base.card.projects[0]!, id: 'raft', title: 'Raft', collaborators: [2, 3].map((n) => ({ username: `gap${n}`, full_name: `Gap ${n}`, member_no: 100 + n })) }]
            : [],
      },
    });
    const hall = [...cards, member(1), member(2), member(3)];

    // Offered only when the hall has what they ask for.
    const offered = (c: readonly PublicCard[], winners?: ReadonlySet<string>) => {
      const kinds = new Set<string>();
      for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
        const { daily, weekly } = pickMissions(d, `2026-W4${d.slice(-1)}`, c, exhibits, null, 0, { winners });
        for (const m of [...daily, ...(weekly ? [weekly] : [])]) kinds.add(`${m.scope}:${m.kind}:${m.n}`);
      }
      return kinds;
    };
    expect(offered(cards)).not.toContain('daily:crew:3');
    expect(offered(cards)).not.toContain('daily:winner:1');
    expect(offered(cards)).not.toContain('weekly:skill:3');
    const more = offered(hall, new Set(['raft']));
    expect(more).toContain('daily:crew:3');
    expect(more).toContain('daily:winner:1');
    expect(more).toContain('weekly:skill:3');
    expect(makeMission('weekly', 'w', 'skill', 'Rust', 3).title).toBe('Meet 3 people who know Rust');
    expect(makeMission('daily', 'd', 'crew', null, 3).title).toBe('Find a project made by 3 or more people');
    expect(makeMission('daily', 'd', 'winner', null, 1).action).toEqual({ to: '/museum?room=winners' });

    const crew = makeMission('daily', 'd', 'crew', null, 3);
    expect(missionMet(crew, EMPTY_PASSPORT, hall, since)).toBe(false);
    expect(missionMet(crew, stamp(EMPTY_PASSPORT, 'people', 'g3', '2026-10-06T08:00:00Z'), hall, since)).toBe(true); // met a maker
    expect(missionMet(crew, stamp(EMPTY_PASSPORT, 'exhibits', 'raft', '2026-10-06T08:00:00Z'), hall, since)).toBe(true); // or opened it
    expect(missionMet({ ...crew, n: 4 }, stamp(EMPTY_PASSPORT, 'people', 'g3', '2026-10-06T08:00:00Z'), hall, since)).toBe(false);

    const winner = makeMission('daily', 'd', 'winner', null, 1);
    const sawRaft = stamp(EMPTY_PASSPORT, 'exhibits', 'raft', '2026-10-06T08:00:00Z');
    expect(missionMet(winner, sawRaft, hall, since, { winners: new Set(['raft']) })).toBe(true);
    expect(missionMet(winner, sawRaft, hall, since, { winners: new Set(['kite']) })).toBe(false);
    expect(missionMet(winner, { ...sawRaft, exhibits: [{ ...sawRaft.exhibits[0]!, imported: true }] }, hall, since, { winners: new Set(['raft']) })).toBe(false);

    const rust3 = makeMission('weekly', 'w', 'skill', 'rust', 3);
    let p = stamp(stamp(EMPTY_PASSPORT, 'people', 'g1', '2026-10-06T08:00:00Z'), 'people', 'g2', '2026-10-06T09:00:00Z');
    expect(missionMet(rust3, p, hall, since)).toBe(false);
    p = stamp(p, 'people', 'g3', '2026-10-06T10:00:00Z');
    expect(missionMet(rust3, p, hall, since)).toBe(true);
  });
});
