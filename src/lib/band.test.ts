import { describe, expect, it } from 'vitest';
import type { BandItem } from '../types/mart';
import { bandInOrder, bandLabel, defaultBand, MAX_BAND, moveBand, toggleBand } from './band';

const pin: BandItem = { ref: 'pin:guild', kind: 'pin', key: 'guild', name: 'Code Guild', logo: 'a/b.png' };
const badge: BandItem = { ref: 'badge:helper', kind: 'badge', key: 'helper', name: 'Helper', gem: 'star', tone: 'gold' };
const officer: BandItem = { ref: 'officer:team', kind: 'officer', key: 'team', team: 'Officers 2026–27', position: 'President' };
const award: BandItem = { ref: 'award:e1', kind: 'award', event_key: 'spring', event: 'Spring Jam', place: 1, name: null, track: 'Health', project_id: 'p', title: 'Kite', at: '2026-04-01' };

describe('the band', () => {
  it('takes up to three picks, in the order they are picked, and lets one go', () => {
    let picks: string[] = [];
    for (const r of ['pin:guild', 'badge:helper', 'officer:team', 'award:e1']) picks = toggleBand(picks, r);
    expect(picks).toEqual(['pin:guild', 'badge:helper', 'officer:team']);
    expect(picks).toHaveLength(MAX_BAND);
    expect(toggleBand(picks, 'badge:helper')).toEqual(['pin:guild', 'officer:team']);
  });

  it('moves a pick earlier or later, and not past the ends', () => {
    const picks = ['a', 'b', 'c'];
    expect(moveBand(picks, 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveBand(picks, 'a', 1)).toEqual(['b', 'a', 'c']);
    expect(moveBand(picks, 'a', -1)).toEqual(picks);
    expect(moveBand(picks, 'x', 1)).toEqual(picks);
  });

  it('keeps only picks that are still earned, in the member’s order', () => {
    expect(bandInOrder(['badge:helper', 'pin:gone', 'pin:guild'], [pin, badge]).map((i) => i.ref)).toEqual(['badge:helper', 'pin:guild']);
  });

  it('says each one in words', () => {
    expect(bandLabel(pin)).toBe('Code Guild');
    expect(bandLabel(badge)).toBe('Helper');
    expect(bandLabel(officer)).toBe('Officer: President · Officers 2026–27');
    expect(bandLabel(award)).toBe('1st place · Health track at Spring Jam');
  });

  it('before a member chooses, shows what it always has: the officer seat, two ribbons, the badges', () => {
    const seat = { profile_id: 'm', username: 'm', full_name: 'M', position: 'President', seat: 1, team: 'Officers 2026–27', team_key: 'team', term_ends: null, current: true };
    const second = { ...award, project_id: 'q', place: 2 as const };
    const third = { ...award, project_id: 'r', place: 3 as const };
    const band = defaultBand(seat, [award, second, third], [{ key: 'helper', name: 'Helper', gem: 'star', tone: 'gold' }]);
    expect(band.map((i) => i.kind)).toEqual(['officer', 'award', 'award', 'badge']);
    expect(band.map(bandLabel)).toEqual(['Officer: President · Officers 2026–27', '1st place · Health track at Spring Jam', '2nd place · Health track at Spring Jam', 'Helper']);
    expect(new Set(band.map((i) => i.ref)).size).toBe(4);
    expect(defaultBand(null, [], [])).toEqual([]);
  });
});
