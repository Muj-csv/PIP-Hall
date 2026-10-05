import { describe, expect, it } from 'vitest';
import { rankOf } from './rank';

describe('rankOf', () => {
  it('starts every card in the hall as a Member', () => {
    expect(rankOf(0).key).toBe('member');
    expect(rankOf(2).key).toBe('member');
  });
  it('makes 3 to 5 projects a Builder', () => {
    expect(rankOf(3).key).toBe('builder');
    expect(rankOf(5).key).toBe('builder');
  });
  it('makes a full Quest Log a Legend', () => {
    expect(rankOf(6).key).toBe('legend');
  });
});
