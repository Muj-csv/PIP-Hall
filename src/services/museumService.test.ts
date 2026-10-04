import { describe, expect, it } from 'vitest';
import { affiliationKey, museumErrorMessage } from './museumService';

describe('affiliationKey', () => {
  it('makes the key the database accepts', () => {
    expect(affiliationKey('CS Student')).toBe('cs-student');
    expect(affiliationKey('  Org — Member!! ')).toBe('org-member');
    expect(affiliationKey('Á'.repeat(30))).toBe('a'.repeat(24));
  });
});

describe('museumErrorMessage', () => {
  it('explains each refusal', () => {
    expect(museumErrorMessage({ message: 'NO_MUSEUM_ACCESS' })).toMatch(/Museum access/);
    expect(museumErrorMessage({ message: 'NOT_LIVE' })).toMatch(/approved card/);
    expect(museumErrorMessage({ message: 'NOT_ADMIN' })).toMatch(/admins/);
  });
});
