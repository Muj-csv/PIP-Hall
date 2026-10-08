import { describe, expect, it } from 'vitest';
import type { Season } from './seasons';
import { awardLabel, countdown, entriesByTrack, fromManilaInput, kindOf, parseTracks, phaseLine, ribbonOf, toManilaInput, winnersOf, type EventEntry, type MuseumEvent } from './events';

const entry = (id: string, track: string | null): EventEntry => ({
  project_id: id,
  username: `maker-${id}`,
  full_name: `Maker ${id}`,
  avatar_path: null,
  member_no: 1,
  track,
  project: { id, title: `Project ${id}`, description: null, language: null, tech_stack: [], github_url: null, project_url: null, cover_path: null, source: 'manual' } as unknown as EventEntry['project'],
});

const hack: Season = {
  key: 'spring-hack',
  name: 'Spring Hackathon',
  blurb: '',
  starts_on: '2026-10-10',
  ends_on: '2026-10-12',
  mission: null,
  frame: null,
  counts: null,
  kind: 'hackathon',
  tracks: ['Health', 'Education'],
  submissions_close: '2026-10-11T10:00:00.000Z',
  results_at: '2026-10-12T10:00:00.000Z',
  announced_at: null,
  phase: 'open',
};

describe('events', () => {
  it('names places and awards in words, with their track', () => {
    expect(awardLabel({ place: 1, name: null, track: null })).toBe('1st place');
    expect(awardLabel({ place: 3, name: null, track: 'Health' })).toBe('3rd place · Health track');
    expect(awardLabel({ place: null, name: 'Best UI', track: 'Health' }, false)).toBe('Best UI');
    expect(ribbonOf({ place: 2 })).toBe('p2');
    expect(ribbonOf({ place: null })).toBe('award');
  });

  it('treats an event from before the hackathons update as a plain event', () => {
    expect(kindOf({})).toBe('event');
    expect(kindOf({ kind: 'build' })).toBe('build');
  });

  it('counts down in the units people use', () => {
    const now = Date.parse('2026-10-10T10:00:00.000Z');
    expect(countdown('2026-10-10T10:00:30.000Z', now)).toBe('any moment now');
    expect(countdown('2026-10-10T10:12:00.000Z', now)).toBe('in 12 min');
    expect(countdown('2026-10-10T11:00:00.000Z', now)).toBe('in 1 hour');
    expect(countdown('2026-10-11T10:00:00.000Z', now)).toBe('in 24 hours');
    expect(countdown('2026-10-13T10:00:00.000Z', now)).toBe('in 3 days');
    expect(countdown(null, now)).toBe('');
  });

  it('says where the event stands', () => {
    const now = Date.parse('2026-10-10T10:00:00.000Z');
    expect(phaseLine(hack, now)).toBe('Submissions close in 24 hours');
    expect(phaseLine({ ...hack, phase: 'judging' }, now)).toBe('Judging · results in 2 days');
    expect(phaseLine({ ...hack, phase: 'results' }, now)).toBe('Results are in!');
    expect(phaseLine({ ...hack, phase: 'upcoming' }, now)).toBe('Submissions open 10 Oct');
    expect(phaseLine({ ...hack, kind: 'event', phase: 'live' }, now)).toBe('');
  });

  it('lists winners overall first, then by track, and skips one whose project left the card', () => {
    const e: Pick<MuseumEvent, 'awards' | 'entries' | 'tracks'> = {
      tracks: ['Health', 'Education'],
      entries: [entry('a', 'Health'), entry('b', 'Education'), entry('c', 'Health')],
      awards: [
        { place: null, name: 'Best UI', track: 'Health', project_id: 'c' },
        { place: 2, name: null, track: null, project_id: 'b' },
        { place: 1, name: null, track: null, project_id: 'a' },
        { place: null, name: 'People’s Pick', track: null, project_id: 'b' },
        { place: 1, name: null, track: 'Education', project_id: 'gone' },
      ],
    };
    expect(winnersOf(e).map(({ award, entry }) => `${awardLabel(award)}:${entry.project_id}`)).toEqual([
      '1st place:a',
      '2nd place:b',
      'People’s Pick:b',
      'Best UI · Health track:c',
    ]);
  });

  it('groups entries by track in the event’s order', () => {
    const groups = entriesByTrack({ tracks: ['Health', 'Education'], entries: [entry('b', 'Education'), entry('a', 'Health')] });
    expect(groups.map((g) => g.track)).toEqual(['Health', 'Education']);
    expect(entriesByTrack({ tracks: [], entries: [entry('a', null)] })).toEqual([{ track: null, entries: [entry('a', null)] }]);
    expect(entriesByTrack({ tracks: ['Health'], entries: [] })).toEqual([]);
  });

  it('reads the admin’s times on the hall’s calendar (Manila)', () => {
    expect(fromManilaInput('2026-10-12T18:00')).toBe('2026-10-12T10:00:00.000Z');
    expect(toManilaInput('2026-10-12T10:00:00.000Z')).toBe('2026-10-12T18:00');
    expect(fromManilaInput('soon')).toBeNull();
    expect(parseTracks(' Health, ,Education ')).toEqual(['Health', 'Education']);
  });
});
