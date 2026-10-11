import { describe, expect, it } from 'vitest';
import { perkFrameName } from './looks';

describe('affiliation frames', () => {
  it('name the frame by its design; the Member design by its printed label', () => {
    expect(perkFrameName({ key: 'g', name: 'Code Guild', label: 'CODE GUILD MEMBER', design: 'member' })).toBe('CODE GUILD MEMBER frame');
    expect(perkFrameName({ key: 'g', name: 'Code Guild', label: 'CODE GUILD MEMBER' })).toBe('CODE GUILD MEMBER frame'); // before the update
    expect(perkFrameName({ key: 'g', name: 'Code Guild', label: 'Code Guild', design: 'diamond' })).toBe('Code Guild · Diamond frame');
    expect(perkFrameName({ key: 'g', name: 'Code Guild', label: 'Code Guild', design: 'cateye' })).toBe('Code Guild · Cat-eye frame');
  });
});
