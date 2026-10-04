import { describe, expect, it } from 'vitest';
import type { CardData } from '../types/card';
import { MAX_STICKERS, STICKER_SPOTS, placeStickers, seedOf, stickerSources } from './stickers';

const base: CardData = {
  username: 'sample-player-1',
  full_name: 'Sample Player 1',
  tagline: null,
  bio: null,
  role: null,
  org_position: null,
  department: null,
  avatar_path: null,
  github_username: null,
  linkedin_url: null,
  portfolio_url: null,
  public_email: null,
  skills: [],
  theme: 'classic',
  is_featured: false,
  projects: [],
};

describe('stickerSources', () => {
  it('gives nothing to a card with nothing to show', () => {
    expect(stickerSources(base)).toEqual([]);
  });
  it('takes verified GitHub, featured, officer title, then skills, capped at 3', () => {
    const s = stickerSources({ ...base, github_username: 'octocat', is_featured: true, org_position: 'Team lead', skills: ['PWA', 'Go'] });
    expect(s.map((x) => x.label)).toEqual(['✓ GITHUB', 'FEATURED', 'TEAM LEAD']);
    expect(s).toHaveLength(MAX_STICKERS);
  });
  it('fills spare spots with the first skills', () => {
    const s = stickerSources({ ...base, skills: ['PWA', 'Go', 'Rust', 'Lua'] });
    expect(s.map((x) => x.label)).toEqual(['PWA', 'GO', 'RUST']);
  });
});

describe('placeStickers', () => {
  const card = { ...base, github_username: 'octocat', is_featured: true, skills: ['PWA'] };

  it('puts a card’s stickers in the same spots every time', () => {
    expect(placeStickers(card)).toEqual(placeStickers(card));
  });
  it('uses distinct spots on one card', () => {
    const spots = placeStickers(card).map((s) => s.spot);
    expect(new Set(spots).size).toBe(spots.length);
  });
  it('picks the starting spot from the username hash', () => {
    const first = placeStickers(card)[0]!.spot;
    expect(first).toBe(STICKER_SPOTS[seedOf(card.username) % STICKER_SPOTS.length]);
  });
});
