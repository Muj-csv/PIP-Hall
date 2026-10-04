import { describe, expect, it } from 'vitest';
import samples from '../data/sample-cards.json';
import type { PublishedCardRow } from '../types/card';
import { numberCards } from './cardService';

const rows = samples as PublishedCardRow[];

describe('numberCards', () => {
  it('orders by the stable member number and prints it on the badge', () => {
    const numbered = numberCards([...rows].reverse());
    expect(numbered.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(numbered.every((c) => c.no === c.member_no)).toBe(true);
  });
  it('keeps a member’s number when their card is re-approved later (D-034)', () => {
    // Player 1 re-approved after everyone else: published_at moves, the number must not.
    const moved = rows.map((r) => (r.member_no === 1 ? { ...r, published_at: '2026-12-31T00:00:00Z' } : r));
    expect(numberCards(moved).find((c) => c.username === 'sample-player-1')!.no).toBe(1);
  });
});

describe('sample-cards.json (PHASE-1 fixture contract)', () => {
  it('has six clearly labelled sample players', () => {
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.card.full_name.startsWith('Sample Player')).toBe(true);
  });
  it('covers the layout edge cases', () => {
    expect(rows.some((r) => r.card.avatar_path === null)).toBe(true);
    expect(rows.some((r) => r.card.projects.length === 0)).toBe(true);
    expect(rows.some((r) => r.card.projects.length === 6)).toBe(true);
    expect(rows.some((r) => r.card.is_featured)).toBe(true);
    expect(rows.some((r) => r.card.full_name.length === 60)).toBe(true);
  });
  it('respects the database limits', () => {
    for (const r of rows) {
      expect(r.card.full_name.length).toBeLessThanOrEqual(60);
      expect(r.card.projects.length).toBeLessThanOrEqual(6);
      expect(r.card.skills.length).toBeLessThanOrEqual(8);
      expect(r.username).toMatch(/^[a-z0-9][a-z0-9_-]{2,19}$/);
      expect(r.username).toBe(r.card.username);
    }
  });
});
