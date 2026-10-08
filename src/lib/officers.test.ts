import { describe, expect, it } from 'vitest';
import { currentByMember, officerLabel, officerUsernames, parseOfficers, type Officer } from './officers';

const o = (over: Partial<Officer>): Officer => ({
  profile_id: 'id-ada',
  username: 'ada',
  full_name: 'Ada L',
  position: 'President',
  seat: 1,
  team: 'Officers 2026–27',
  team_key: 'officers-2026',
  term_ends: '2027-05-31',
  current: true,
  ...over,
});

describe('officers', () => {
  it('says the position and the team, in words', () => {
    expect(officerLabel(o({}))).toBe('President · Officers 2026–27');
    expect(officerLabel(o({ position: null }))).toBe('Officers 2026–27');
  });

  it('knows who is an officer now, and leaves past terms out', () => {
    const list = [o({}), o({ profile_id: 'id-bo', username: 'bo', position: 'Treasurer', seat: 3 }), o({ profile_id: 'id-cy', username: 'cy', current: false, team: 'Officers 2025–26' })];
    expect([...currentByMember(list).keys()]).toEqual(['id-ada', 'id-bo']);
    expect([...officerUsernames(list)]).toEqual(['ada', 'bo']);
  });

  it('reads hall_officers() rows safely', () => {
    expect(parseOfficers(null)).toEqual([]);
    expect(parseOfficers([{ username: 'x' }, { profile_id: 'p', username: 'u', team: 'T', seat: '2', position: '' }])).toEqual([
      { profile_id: 'p', username: 'u', full_name: 'u', position: null, seat: 2, team: 'T', team_key: '', term_ends: null, current: true },
    ]);
  });
});
