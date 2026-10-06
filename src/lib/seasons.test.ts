import { describe, expect, it } from 'vitest';
import { countsLine, dateRange, seasonMission, seasonStart, type Season } from './seasons';

const week: Season = {
  key: 'build-week',
  name: 'Build Week',
  blurb: 'Ship something small.',
  starts_on: '2026-10-06',
  ends_on: '2026-10-12',
  mission: { kind: 'people', param: null, n: 3, reward: 30 },
  frame: null,
  counts: { joined: 1, projects: 0, exhibits: 2, teamups: 1 },
};

describe('seasons', () => {
  it('writes dates the way people say them', () => {
    expect(dateRange('2026-10-06', '2026-10-12', 2026)).toBe('6–12 Oct');
    expect(dateRange('2026-10-28', '2026-11-03', 2026)).toBe('28 Oct – 3 Nov');
    expect(dateRange('2026-10-06', '2026-10-06', 2026)).toBe('6 Oct');
    expect(dateRange('2026-12-28', '2027-01-03', 2026)).toBe('28 Dec 2026 – 3 Jan 2027');
  });

  it('turns the event’s Mission into one the hall can check, with its own key', () => {
    const m = seasonMission(week)!;
    expect(m.key).toBe('season:build-week');
    expect(m.title).toBe('Meet 3 people you haven’t met');
    expect(m.scope).toBe('season');
    expect(seasonMission({ ...week, mission: null })).toBeNull();
  });

  it('starts at midnight Manila on its first day', () => {
    expect(seasonStart(week).toISOString()).toBe('2026-10-05T16:00:00.000Z');
  });

  it('says every count, zeros too, and nothing else', () => {
    expect(countsLine(week.counts!)).toBe('1 joined · 0 projects · 2 exhibits · 1 team-up');
  });
});
