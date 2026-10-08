import { describe, expect, it } from 'vitest';
import type { PublicProject } from '../types/card';
import type { Exhibit } from '../types/museum';
import type { ArchiveExhibit, TrophyCase } from './archive';
import type { Award, EventEntry, MuseumEvent } from './events';
import {
  DOOR_GAP,
  GROUP_GAP,
  STOP_SPACING,
  awardLine,
  awardsByProject,
  layoutWalk,
  nearestStop,
  planRooms,
  plaqueBy,
  releaseStop,
  roomAt,
  roomFromParams,
  roomMakers,
  roomParams,
  stopLine,
  stopsNear,
  walkBand,
  type MuseumParts,
} from './museumWalk';
import { DEFAULT_WINGS, parseWings, wingStyle } from './wings';

const exhibit = (id: string, over: Partial<PublicProject> = {}, featured = false): Exhibit => ({
  project_id: id,
  username: `u-${id}`,
  full_name: `Maker ${id}`,
  avatar_path: null,
  member_no: 1,
  featured,
  project: { title: `P ${id}`, description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], source: 'manual', project_date: null, ...over },
});
const entry = (id: string, track: string | null = null): EventEntry => ({ ...exhibit(id), track });
const event = (over: Partial<MuseumEvent>): MuseumEvent => ({
  key: 'hack',
  name: 'Spring Hackathon',
  blurb: '',
  starts_on: '2026-09-01',
  ends_on: '2026-09-03',
  mission: null,
  frame: null,
  counts: null,
  kind: 'hackathon',
  tracks: [],
  entries: [],
  awards: [],
  ...over,
});
const past = (over: Partial<ArchiveExhibit>): ArchiveExhibit => ({
  id: 'k1',
  title: 'Kite',
  description: '',
  year: 2024,
  event_key: null,
  event: 'Old Hackathon 2024',
  track: null,
  award: null,
  team_name: 'Team Kite',
  tech: [],
  project_url: null,
  github_url: null,
  video_url: null,
  cover_path: null,
  makers: [],
  team_size: 3,
  ...over,
});
const first: Award = { place: 1, name: null, track: null, note: 'Bold.', project_id: 'a' };
const named: Award = { place: null, name: 'Best UI', track: null, note: '', project_id: 'a' };

const empty: MuseumParts = { trophies: [], events: [], wings: [], everything: { featured: [], rest: [] }, archive: [] };

describe('the walkable Museum: rooms', () => {
  it('walks the Winners’ Hall, the events, the wings, All exhibits, then the Archive', () => {
    const a = entry('a');
    const b = entry('b');
    const hack = event({ entries: [b, a], awards: [first] });
    const trophies: TrophyCase[] = [{ key: 'hack', title: 'Spring Hackathon', sub: 'Hackathon', eventKey: 'hack', year: null, sort: '2026-09-01', winners: [{ award: first, entry: a }] }];
    const rooms = planRooms({
      trophies,
      events: [hack],
      wings: [{ wing: DEFAULT_WINGS[3]!, exhibits: [a] }],
      everything: { featured: [], rest: [a, b] },
      archive: [past({})],
    });
    expect(rooms.map((r) => r.id)).toEqual(['winners', 'event:hack', 'wing:web', 'all', 'archive']);
    expect(rooms.map((r) => r.style)).toEqual(['trophy', 'arcade', 'garden', 'garden', 'library']);
    // In its event's room the winner leads, on its pedestal, with its award on the plaque.
    expect(rooms[1]!.groups[0]!.stops.map((s) => s.exhibit.project_id)).toEqual(['a', 'b']);
    expect(rooms[1]!.groups[0]!.stops[0]!.awards).toEqual([{ award: first, event: 'Spring Hackathon' }]);
    // A winner wears its award in every room it hangs in.
    expect(rooms[2]!.groups[0]!.stops[0]!.awards[0]!.award).toBe(first);
    expect(rooms[3]!.groups.flatMap((g) => g.stops).find((s) => s.exhibit.project_id === 'b')!.awards).toEqual([]);
  });

  it('leaves empty rooms out, and an empty Museum has none', () => {
    expect(planRooms(empty)).toEqual([]);
    const rooms = planRooms({ ...empty, events: [event({})], everything: { featured: [], rest: [exhibit('x')] } });
    expect(rooms.map((r) => r.id)).toEqual(['all']);
  });

  it('stands a project with two awards at one event once, with both', () => {
    const a = entry('a');
    const t: TrophyCase = { key: 'hack', title: 'Spring Hackathon', sub: '', eventKey: 'hack', year: null, sort: '', winners: [{ award: first, entry: a }, { award: named, entry: a }] };
    const [hall] = planRooms({ ...empty, trophies: [t] });
    expect(hall!.groups[0]!.stops).toHaveLength(1);
    expect(hall!.groups[0]!.stops[0]!.awards.map((x) => awardLine(x))).toEqual(['1st place · Spring Hackathon', 'Best UI · Spring Hackathon']);
  });

  it('signs the event’s tracks and the archive’s years, and pins featured makers first in All exhibits', () => {
    const hack = event({ tracks: ['Health', 'Climate'], entries: [entry('c', 'Climate'), entry('h', 'Health')] });
    const f = exhibit('f', {}, true);
    const rooms = planRooms({ ...empty, events: [hack], everything: { featured: [f], rest: [exhibit('r')] }, archive: [past({ id: 'old', year: 2023 }), past({ id: 'new', year: 2025 })] });
    expect(rooms[0]!.groups.map((g) => g.title)).toEqual(['Health track', 'Climate track']);
    expect(rooms[1]!.groups.map((g) => g.title)).toEqual(['Featured', 'More exhibits']);
    expect(rooms[2]!.groups.map((g) => g.title)).toEqual(['2025', '2023']);
  });

  it('gives each event kind its own style, and wings the one an admin picked', () => {
    const kinds = planRooms({ ...empty, events: [event({ key: 'a', kind: 'build', entries: [entry('x')] }), event({ key: 'b', kind: 'event', entries: [entry('y')] })] });
    expect(kinds.map((r) => r.style)).toEqual(['lab', 'garden']);
    expect(wingStyle({ key: 'web', kind: 'tags', style: 'library' })).toBe('library');
    expect(wingStyle({ key: 'robots', kind: 'tags' })).toBe('arcade');
    expect(DEFAULT_WINGS.map(wingStyle)).toEqual(['garden', 'lab', 'library', 'garden', 'arcade', 'lab']);
    expect(parseWings([{ key: 'web', kind: 'tags', name: 'Web', tags: [], style: 'trophy' }, { key: 'x', kind: 'tags', name: 'X', tags: [], style: 'disco' }]).map((w) => w.style)).toEqual(['trophy', undefined]);
  });

  it('counts an archive award from a recorded event once', () => {
    const hack = event({ awards: [{ ...first, project_id: 'k1' }] });
    const won = awardsByProject([hack], [past({ event_key: 'hack', award: { place: 1, name: null, track: null, note: '' } })]);
    expect(won.get('k1')).toHaveLength(1);
    expect(awardsByProject([], [past({ award: { place: 2, name: null, track: null, note: '' } })]).get('k1')![0]!.event).toBe('Old Hackathon 2024');
  });
});

describe('the walkable Museum: the corridor', () => {
  const rooms = planRooms({
    ...empty,
    events: [event({ tracks: ['Health'], entries: [entry('h', 'Health'), entry('n')] })],
    everything: { featured: [], rest: [exhibit('x'), exhibit('y')] },
  });
  const layout = layoutWalk(rooms);

  it('hangs each room behind its doorway, signs before their groups, exhibits evenly', () => {
    expect(layout.rooms.map((r) => [r.x0, r.first, r.count])).toEqual([
      [0, 0, 2],
      [layout.rooms[0]!.x1, 2, 2],
    ]);
    const [h, n, x, y] = layout.stops;
    expect(h!.x).toBe(DOOR_GAP / 2 + GROUP_GAP + STOP_SPACING / 2);
    expect(n!.x - h!.x).toBe(STOP_SPACING); // the loose entries have no sign of their own
    expect(y!.x - x!.x).toBe(STOP_SPACING);
    expect(layout.signs.map((s) => [s.kind, s.text])).toEqual([
      ['door', 'Spring Hackathon'],
      ['group', 'Health track'],
      ['door', 'All exhibits'],
    ]);
    expect(layout.width).toBe(layout.rooms[1]!.x1);
    expect(layout.stops.map((s) => s.nth)).toEqual([1, 2, 1, 2]);
    expect(layout.stops.map((s) => s.group)).toEqual(['Health track', null, null, null]);
  });

  it('finds the nearest exhibit, the room, and what is near the camera', () => {
    const xs = layout.stops.map((s) => s.x);
    expect(nearestStop(layout.stops, -100)).toBe(0);
    expect(nearestStop(layout.stops, xs[2]! + 1)).toBe(2);
    expect(nearestStop(layout.stops, 1e6)).toBe(3);
    expect(nearestStop([], 5)).toBe(0);
    expect(roomAt(layout.rooms, xs[1]!)).toBe(0);
    expect(roomAt(layout.rooms, xs[2]!)).toBe(1);
    expect(stopsNear(layout.stops, xs[1]!, 10)).toEqual([1, 1]);
    expect(stopsNear(layout.stops, xs[1]!, STOP_SPACING * 3)).toEqual([0, 3]);
    expect(stopsNear([], 0, 10)).toEqual([0, -1]);
  });

  it('settles a drag on the nearest exhibit, or one on for a flick, and holds the ends', () => {
    const xs = layout.stops.map((s) => s.x);
    expect(releaseStop(layout.stops, xs[2]! - 10, 0, 0)).toBe(2);
    expect(releaseStop(layout.stops, xs[0]!, 0, -1)).toBe(1);
    expect(releaseStop(layout.stops, xs[0]!, 0, 1)).toBe(0);
    expect(releaseStop(layout.stops, xs[3]!, 3, -1)).toBe(3);
    expect(walkBand(layout.stops, xs[1]!)).toBe(xs[1]);
    expect(walkBand(layout.stops, -1000)).toBeGreaterThan(-1000);
  });

  it('puts the walk into words, from the data', () => {
    expect(stopLine(layout, 0)).toBe('Spring Hackathon, 1 of 2: P h, by Maker h. OPEN visits it.');
    const team = exhibit('t', { collaborators: [{ username: 'b', full_name: 'Bo', member_no: 2 }, { username: 'c', full_name: 'Cy', member_no: 3 }] });
    expect(plaqueBy(team)).toBe('Maker t with Bo and Cy');
    expect(stopLine(layout, 99)).toBe('');
  });

  it('keeps rooms in the address the list view uses', () => {
    for (const id of ['winners', 'all', 'archive', 'event:hack', 'wing:web']) {
      const [k, v] = roomParams(id);
      expect(roomFromParams(new URLSearchParams({ [k]: v }))).toBe(id);
    }
    expect(roomFromParams(new URLSearchParams('room=nope'))).toBeNull();
    expect(roomFromParams(new URLSearchParams(''))).toBeNull();
  });
});

describe('the walkable Museum: makers in a room', () => {
  it('lists every maker once, members by badge, archive makers only as named', () => {
    const a = exhibit('a', { collaborators: [{ username: 'u-b', full_name: 'Maker b', member_no: 2 }] });
    const b = exhibit('b');
    const old = { ...exhibit('k1'), archive: past({ makers: [{ username: 'u-a', full_name: 'Maker a' }, { full_name: 'Rosa Diaz' }], team_size: 4 }) };
    const layout = layoutWalk(planRooms({ ...empty, everything: { featured: [], rest: [a, b, old] } }));
    expect(roomMakers(layout, 0)).toEqual([
      { username: 'u-a', name: 'Maker a', stop: 0 },
      { username: 'u-b', name: 'Maker b', stop: 0 },
      { username: null, name: 'Rosa Diaz', stop: 2 },
    ]);
    expect(roomMakers(layout, 5)).toEqual([]);
  });
});
