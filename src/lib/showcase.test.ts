import { describe, expect, it } from 'vitest';
import type { PublicProject } from '../types/card';
import type { Exhibit } from '../types/museum';
import type { ArchiveExhibit } from './archive';
import type { Award, EventEntry, MuseumEvent } from './events';
import {
  boothPath,
  checkinUrl,
  inRoomPath,
  nextInRoom,
  placardsFor,
  placardUrl,
  printPath,
  printTarget,
  roomStops,
  sheets,
  showcaseRooms,
  tourStops,
  type MuseumData,
} from './showcase';
import { DEFAULT_WINGS } from './wings';

const exhibit = (id: string, title: string, over: Partial<PublicProject> = {}, featured = false): Exhibit => ({
  project_id: id,
  username: `u-${id}`,
  full_name: `Maker ${id}`,
  avatar_path: null,
  member_no: 1,
  featured,
  project: { title, description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], source: 'manual', project_date: null, ...over },
});
const entry = (id: string, title: string, track: string | null = null): EventEntry => ({ ...exhibit(id, title), track });
const kiteWon: Award = { place: 1, name: null, track: null, note: 'A clear idea.', project_id: 'k' };
const hack: MuseumEvent = {
  key: 'spring-hack',
  name: 'Spring Hackathon',
  blurb: '',
  starts_on: '2026-10-07',
  ends_on: '2026-10-09',
  mission: null,
  frame: null,
  counts: null,
  kind: 'hackathon',
  tracks: [],
  entries: [entry('o', 'Orbit'), entry('k', 'Kite')],
  awards: [kiteWon],
};
const old: ArchiveExhibit = {
  id: 'z',
  title: 'Zeppelin',
  description: '',
  year: 2024,
  event_key: null,
  event: 'Old Hackathon 2024',
  track: null,
  award: null,
  team_name: 'Team Z',
  tech: [],
  project_url: null,
  github_url: null,
  video_url: null,
  cover_path: null,
  makers: [],
  team_size: 0,
};
const data: MuseumData = {
  exhibits: [exhibit('c', 'Comet', { tech_stack: ['TypeScript'] }), exhibit('a', 'Atlas', { tech_stack: ['TypeScript'] }), exhibit('b', 'Beacon', {}, true)],
  wings: DEFAULT_WINGS,
  events: [hack],
  archive: [old],
};

describe('the showcase: rooms in one fixed order', () => {
  const rooms = showcaseRooms(data);
  it('plans the walkable Museum’s rooms, each in a fixed order: featured first, then by title', () => {
    expect(rooms.map((r) => r.id)).toEqual(['winners', 'event:spring-hack', 'wing:featured', 'wing:web', 'all', 'archive']);
    expect(roomStops(rooms.find((r) => r.id === 'all')!).map((s) => s.exhibit.project.title)).toEqual(['Beacon', 'Atlas', 'Comet', 'Zeppelin']);
    expect(roomStops(rooms.find((r) => r.id === 'wing:web')!).map((s) => s.exhibit.project.title)).toEqual(['Atlas', 'Comet']);
    // Every visit, every device: the same order.
    expect(showcaseRooms({ ...data, exhibits: [...data.exhibits].reverse() }).map((r) => roomStops(r).map((s) => s.exhibit.project_id))).toEqual(rooms.map((r) => roomStops(r).map((s) => s.exhibit.project_id)));
  });

  it('a kiosk for an event tours its room, winners first; without one, every exhibit once', () => {
    expect(tourStops(rooms, 'spring-hack').map((s) => s.exhibit.project.title)).toEqual(['Kite', 'Orbit']);
    expect(tourStops(rooms, 'spring-hack')[0]!.awards[0]!.award.note).toBe('A clear idea.');
    const all = tourStops(rooms, null);
    expect(all.map((s) => s.exhibit.project_id)).toEqual(['k', 'o', 'b', 'a', 'c', 'z']);
    expect(all[0]!.roomName).toBe('Winners’ Hall');
    expect(tourStops(rooms, 'no-such-event')).toEqual(all);
  });

  it('the next exhibit in the room goes round the room', () => {
    expect(nextInRoom(rooms, 'event:spring-hack', 'k')).toMatchObject({ stop: { exhibit: { project_id: 'o' } }, nth: 2, count: 2 });
    expect(nextInRoom(rooms, 'event:spring-hack', 'o')).toMatchObject({ stop: { exhibit: { project_id: 'k' } }, nth: 1 });
    expect(nextInRoom(rooms, 'winners', 'k')).toBeNull(); // alone there
    expect(nextInRoom(rooms, 'wing:web', 'k')).toBeNull(); // not in that room
    expect(nextInRoom(rooms, 'nope', 'k')).toBeNull();
  });
});

describe('the showcase: placards', () => {
  const rooms = showcaseRooms(data);
  it('reads what to print from the address, and back', () => {
    expect(printTarget(new URLSearchParams('event=spring-hack'))).toEqual({ kind: 'event', key: 'spring-hack' });
    expect(printTarget(new URLSearchParams('room=wing%3Aweb'))).toEqual({ kind: 'room', id: 'wing:web' });
    expect(printTarget(new URLSearchParams('exhibit=k'))).toEqual({ kind: 'exhibit', id: 'k' });
    expect(printTarget(new URLSearchParams(''))).toBeNull();
    expect(printPath({ kind: 'room', id: 'wing:web' })).toBe('/print?room=wing%3Aweb');
    expect(printPath({ kind: 'event', key: 'spring-hack' })).toBe('/print?event=spring-hack');
  });

  it('one placard per exhibit, with makers, event and year, award, the judges’ note and its QR', () => {
    const set = placardsFor(rooms, { kind: 'event', key: 'spring-hack' })!;
    expect(set.title).toBe('Spring Hackathon');
    const [kite, orbit] = set.placards;
    expect(kite).toMatchObject({ title: 'Kite', by: 'Maker k', origin: 'Spring Hackathon · 2026', note: 'A clear idea.', room: 'event:spring-hack' });
    expect(kite!.awards.map((a) => a.award.place)).toEqual([1]);
    expect(kite!.qr).toMatch(/\/museum\/k\?via=placard&room=event%3Aspring-hack$/);
    expect(orbit).toMatchObject({ title: 'Orbit', note: null, awards: [] });
  });

  it('an archive placard names its event once, and a team the archive may not name', () => {
    const set = placardsFor(rooms, { kind: 'room', id: 'archive' })!;
    expect(set.placards[0]).toMatchObject({ title: 'Zeppelin', by: null, team: 'Team Z', origin: 'Old Hackathon 2024' });
  });

  it('a single exhibit prints in the first room it hangs in; nothing for what isn’t on show', () => {
    expect(placardsFor(rooms, { kind: 'exhibit', id: 'a' })!.placards.map((p) => p.room)).toEqual(['wing:web']);
    expect(placardsFor(rooms, { kind: 'exhibit', id: 'gone' })).toBeNull();
    expect(placardsFor(rooms, { kind: 'room', id: 'wing:games' })).toBeNull();
  });

  it('four to a page', () => {
    expect(sheets([1, 2, 3, 4, 5]).map((p) => p.length)).toEqual([4, 1]);
    expect(sheets([])).toEqual([]);
  });
});

describe('the showcase: links', () => {
  it('the kiosk carries the event and its code; the check-in QR carries the code; walking on keeps the room', () => {
    expect(boothPath('spring-hack', 'abcdef123456')).toBe('/booth?event=spring-hack&c=abcdef123456');
    expect(boothPath('spring-hack', null)).toBe('/booth?event=spring-hack');
    expect(boothPath()).toBe('/booth');
    expect(checkinUrl('spring-hack', 'abcdef123456')).toMatch(/\/checkin\/spring-hack\?c=abcdef123456$/);
    expect(placardUrl('k', 'wing:web')).toMatch(/\/museum\/k\?via=placard&room=wing%3Aweb$/);
    expect(inRoomPath('k', 'wing:web')).toBe('/museum/k?room=wing%3Aweb');
  });
});
