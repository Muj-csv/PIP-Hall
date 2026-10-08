import { describe, expect, it } from 'vitest';
import { archiveAsExhibit, archiveCases, archiveCredit, archiveOrigin, byYear, parseArchive, withArchive, type ArchiveExhibit } from './archive';
import type { MuseumEvent } from './events';

const past = (over: Partial<ArchiveExhibit>): ArchiveExhibit => ({
  id: 'k1',
  title: 'Kite',
  description: 'A kite that tweets the wind.',
  year: 2024,
  event_key: null,
  event: 'Spring Hackathon 2024',
  track: 'Health',
  award: { place: 1, name: null, track: null, note: 'Brilliant.' },
  team_name: 'Team Kite',
  tech: ['Python', 'Arduino'],
  project_url: null,
  github_url: null,
  video_url: null,
  cover_path: null,
  makers: [],
  team_size: 3,
  ...over,
});

describe('archive', () => {
  it('credits only who may be named, and counts the rest', () => {
    expect(archiveCredit(past({}))).toBe('Team Kite');
    expect(archiveCredit(past({ team_name: null }))).toBe('a team of 3');
    expect(archiveCredit(past({ team_name: null, team_size: 1 }))).toBe('one maker');
    expect(archiveCredit(past({ team_name: null, team_size: 0 }))).toBeNull();
    expect(archiveCredit(past({ makers: [{ username: 'ada', full_name: 'Ada L', member_no: 4 }] }))).toBe('Ada L and 2 more · Team Kite');
    expect(archiveCredit(past({ team_name: null, team_size: 2, makers: [{ full_name: 'Rosa Diaz' }, { username: 'ada', full_name: 'Ada L' }] }))).toBe('Rosa Diaz and Ada L');
  });

  it('says where and when it was made', () => {
    expect(archiveOrigin(past({}))).toBe('Spring Hackathon 2024 · Health track');
    expect(archiveOrigin(past({ event: null, track: null }))).toBe('2024');
  });

  it('hangs as an exhibit: linked members stand in as maker and collaborators, for the Collab wing', () => {
    const e = archiveAsExhibit(past({ makers: [{ username: 'ada', full_name: 'Ada L', member_no: 4 }, { full_name: 'Rosa Diaz' }, { username: 'bo', full_name: 'Bo', member_no: 9 }] }));
    expect(e.username).toBe('ada');
    expect(e.member_no).toBe(4);
    expect(e.project.collaborators).toEqual([{ username: 'bo', full_name: 'Bo', member_no: 9 }]);
    expect(e.project.tech_stack).toEqual(['Python', 'Arduino']);
    expect(e.featured).toBe(false);
    expect(e.archive?.id).toBe('k1');
    expect(archiveAsExhibit(past({})).project.collaborators).toEqual([]);
  });

  it('groups the Archive by year, newest first', () => {
    const rooms = byYear([past({ id: 'a', year: 2023, title: 'B' }), past({ id: 'b', year: 2024 }), past({ id: 'c', year: 2023, title: 'A' })]);
    expect(rooms.map((r) => [r.year, r.items.map((i) => i.title)])).toEqual([
      [2024, ['Kite']],
      [2023, ['A', 'B']],
    ]);
  });

  it('puts exhibits from a recorded event in its room, with their awards', () => {
    const ev = { key: 'spring', name: 'Spring Hackathon', tracks: ['Health'], entries: [], awards: [] } as unknown as MuseumEvent;
    const [room] = withArchive([ev], [past({ event_key: 'spring' }), past({ id: 'other', event_key: null })]);
    expect(room!.entries.map((e) => e.project_id)).toEqual(['k1']);
    expect(room!.entries[0]!.track).toBe('Health');
    expect(room!.awards).toEqual([{ place: 1, name: null, track: null, note: 'Brilliant.', project_id: 'k1' }]);
  });

  it('gives older events their own case in the Winners’ Hall, but not events that have a room', () => {
    const cases = archiveCases(
      [
        past({ id: 'a', award: { place: 2, name: null, track: null, note: '' } }),
        past({ id: 'b' }),
        past({ id: 'c', event: 'Build Week 2023', year: 2023, award: { place: null, name: 'Best UI', track: null, note: '' } }),
        past({ id: 'd', event_key: 'spring' }),
        past({ id: 'e', award: null }),
        past({ id: 'f', event: null, year: 2022 }),
      ],
      new Set(['spring']),
    );
    expect(cases.map((c) => [c.title, c.sub, c.winners.map((w) => w.entry.project_id)])).toEqual([
      ['Spring Hackathon 2024', 'From the Archive', ['b', 'a']],
      ['Build Week 2023', 'From the Archive', ['c']],
    ]);
  });

  it('reads museum_archive() rows safely', () => {
    expect(parseArchive(null)).toEqual([]);
    expect(parseArchive([{ id: 'x' }, { id: 'k', title: 'Kite', year: 2024, team_size: '2', tech: ['Go', 3] }])).toMatchObject([{ id: 'k', team_size: 2, tech: ['Go'], award: null, makers: [] }]);
  });
});
