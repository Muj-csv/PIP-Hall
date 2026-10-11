import { describe, expect, it } from 'vitest';
import samples from '../data/sample-cards.json';
import type { PublicCard, PublicProject } from '../types/card';
import type { Exhibit, MuseumCuration } from '../types/museum';
import { arrangeRooms, isShut, NO_CURATION, parseCuration, picksByWing, portraits, signOf, stopPath } from './curation';
import { curatedEvents, type MuseumEvent } from './events';
import { layoutWalk, planRooms, roomFromParams, stopLine, type MuseumParts } from './museumWalk';
import { DEFAULT_WINGS, wingRooms, wingRule, type Wing } from './wings';

const card = (i: number): PublicCard => ({ ...(samples[i] as unknown as PublicCard), no: samples[i]!.member_no });
const exhibit = (id: string, over: Partial<PublicProject> = {}): Exhibit => ({
  project_id: id,
  username: `u-${id}`,
  full_name: `Maker ${id}`,
  avatar_path: null,
  member_no: 1,
  project: { title: `Project ${id}`, description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], source: 'manual', project_date: null, ...over },
});
const curation = (over: Partial<MuseumCuration>): MuseumCuration => ({ ...NO_CURATION, ...over });

describe('the Museum, curated end to end (D-133)', () => {
  it('reads museum_curation(), dropping what it can’t use', () => {
    const c = parseCuration({
      rooms: [{ key: 'archive', sign: ' The Vault ', hidden: false }, { key: 'attic' }, { key: 'winners', hidden: true }, 'nope'],
      portraits: [{ member_id: 'm1', note: 'Hi' }, { note: 'no id' }],
      picks: [{ wing: 'web', project_id: 'p1' }, { wing: 'web' }],
    });
    expect(c.rooms).toEqual([{ key: 'archive', sign: 'The Vault', hidden: false }, { key: 'winners', sign: null, hidden: true }]);
    expect(c.portraits).toEqual([{ member_id: 'm1', note: 'Hi' }]);
    expect(c.picks).toEqual([{ wing: 'web', project_id: 'p1' }]);
    expect(parseCuration(null)).toEqual(NO_CURATION);
  });

  it('puts the rooms the admins placed first, in their order, signs them, and leaves shut ones out', () => {
    const rooms = ['winners', 'event:spring', 'wing:web', 'all', 'archive'].map((id) => ({ id, name: id.toUpperCase() }));
    const c = curation({ rooms: [{ key: 'archive', sign: 'The Vault', hidden: false }, { key: 'winners', sign: null, hidden: true }, { key: 'wing:web', sign: null, hidden: false }] });
    expect(arrangeRooms(rooms, c).map((r) => [r.id, r.name])).toEqual([
      ['archive', 'The Vault'],
      ['wing:web', 'WING:WEB'],
      ['event:spring', 'EVENT:SPRING'],
      ['all', 'ALL'],
    ]);
    expect(isShut(c, 'winners')).toBe(true);
    expect(signOf(c, 'all', 'All exhibits')).toBe('All exhibits');
    expect(arrangeRooms(rooms, NO_CURATION).map((r) => r.id)).toEqual(rooms.map((r) => r.id));
  });

  it('hangs a hand-picked exhibit in a wing, before the ones its tools bring in', () => {
    const web = DEFAULT_WINGS.find((w) => w.key === 'web')!;
    const picked: Wing = { key: 'picks', kind: 'tags', name: 'Curators’ Picks', note: '', tags: [] };
    const all = [exhibit('a', { language: 'TypeScript' }), exhibit('b'), exhibit('c', { language: 'TypeScript' })];
    const picks = picksByWing(curation({ picks: [{ wing: 'picks', project_id: 'b' }, { wing: 'web', project_id: 'b' }, { wing: 'picks', project_id: 'gone' }] }));
    const rooms = wingRooms([web, picked], all, { picks });
    expect(rooms.find((r) => r.wing.key === 'web')!.exhibits.map((e) => e.project_id)).toEqual(['b', 'a', 'c']);
    expect(rooms.find((r) => r.wing.key === 'picks')!.exhibits.map((e) => e.project_id)).toEqual(['b']);
    expect(wingRule(picked)).toBe('Exhibits the curators picked for this wing.');
    expect(wingRooms([picked], all).length).toBe(0); // nothing picked: the wing has nothing on show
  });

  it('hangs featured members as portraits that lead to their profiles', () => {
    const cards = [card(0), card(1)];
    const shown = portraits(curation({ portraits: [{ member_id: cards[1]!.profile_id, note: 'Built the kiosk.' }, { member_id: 'nobody', note: '' }] }), cards);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.portrait?.note).toBe('Built the kiosk.');
    expect(shown[0]!.project_id).toBe(`member:${cards[1]!.username}`);
    expect(stopPath(shown[0]!)).toBe(`/member/${cards[1]!.username}`);
    expect(stopPath(exhibit('p1'))).toBe('/museum/p1');
  });

  it('gives the Featured Members room its place among the rooms, and its own words', () => {
    const member = portraits(curation({ portraits: [{ member_id: card(0).profile_id, note: 'Kind.' }] }), [card(0)]);
    const parts: MuseumParts = { trophies: [], events: [], wings: [], everything: { featured: [], rest: [exhibit('a')] }, archive: [], members: member };
    expect(planRooms(parts).map((r) => r.id)).toEqual(['members', 'all']);
    const walk = layoutWalk(planRooms(parts));
    expect(stopLine(walk, 0)).toBe(`Featured Members, 1 of 1: ${card(0).card.full_name}. “Kind.” OPEN opens their profile.`);
    expect(roomFromParams(new URLSearchParams('room=members'))).toBe('members');
    const arranged = planRooms({ ...parts, curation: { rooms: [{ key: 'all', sign: 'Everything', hidden: false }, { key: 'members', sign: null, hidden: true }] } });
    expect(arranged.map((r) => [r.id, r.name])).toEqual([['all', 'Everything']]);
  });

  it('hangs only the winners an admin hung, and keeps every award for the plaques', () => {
    const base = { key: 'spring', kind: 'hackathon', name: 'Spring', blurb: '', starts_on: '2026-10-01', ends_on: '2026-10-02', phase: 'results', tracks: [], mission: null, frame: null, counts: null } as unknown as MuseumEvent;
    const entry = (id: string) => ({ ...exhibit(id), track: null });
    const e: MuseumEvent = { ...base, entries: [entry('a'), entry('b')], awards: [{ place: 1, name: null, track: null, project_id: 'a', hung: true }, { place: 2, name: null, track: null, project_id: 'b', hung: false }] };
    const [shown] = curatedEvents([e]);
    expect(shown!.entries.map((x) => x.project_id)).toEqual(['a']);
    expect(shown!.awards).toHaveLength(2);
    // Before the update, awards carry no flag: every winner hangs, as under D-130.
    const old = curatedEvents([{ ...e, awards: e.awards.map((a) => ({ ...a, hung: undefined })) }]);
    expect(old[0]!.entries.map((x) => x.project_id)).toEqual(['a', 'b']);
  });
});
