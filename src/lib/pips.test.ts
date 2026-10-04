import { describe, expect, it } from 'vitest';
import { discoverLine, formatPips, reasonLabel } from './pips';

const ACH = [{ key: 'explorer', name: 'Explorer', description: '', reward: 100 }];

describe('reasonLabel', () => {
  it('says each reason in plain words', () => {
    expect(reasonLabel({ reason: 'discover', ref: 'discover:x' })).toBe('Discovered a member');
    expect(reasonLabel({ reason: 'first_approval', ref: 'first_approval' })).toBe('Your card joined the hall');
    expect(reasonLabel({ reason: 'achievement', ref: 'achievement:explorer' }, ACH)).toBe('Achievement: Explorer');
  });
});

describe('discoverLine', () => {
  it('celebrates a paid discovery and any achievement', () => {
    expect(discoverLine({ granted: true, new: true, amount: 5, unlocked: ['explorer'], balance: 10 }, ACH)).toBe('You found someone new! +5 PIPs. ACHIEVEMENT: Explorer! +100 PIPs.');
  });
  it('explains a discovery past the daily cap', () => {
    expect(discoverLine({ granted: false, new: true, amount: 0, unlocked: [], balance: 10 })).toMatch(/maxed for today/);
  });
  it('stays quiet on a repeat visit', () => {
    expect(discoverLine({ granted: false, new: false, amount: 0, unlocked: [], balance: 10 })).toBeNull();
  });
});

describe('formatPips', () => {
  it('groups thousands', () => expect(formatPips(1240)).toBe('1,240'));
});
