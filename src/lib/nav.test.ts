import { describe, expect, it } from 'vitest';
import { navSection } from './nav';

describe('navSection', () => {
  it('marks the hall for the hall and the profiles inside it', () => {
    expect(navSection('/')).toBe('hall');
    expect(navSection('/member/ada')).toBe('hall');
  });
  it('marks the Museum, its exhibits, the Mart and Admin', () => {
    expect(navSection('/museum')).toBe('museum');
    expect(navSection('/museum/abc')).toBe('museum');
    expect(navSection('/mart')).toBe('mart');
    expect(navSection('/admin')).toBe('admin');
  });
  it('marks the card button for making and managing a card', () => {
    for (const p of ['/edit', '/login', '/settings']) expect(navSection(p)).toBe('card');
  });
  it('marks nothing elsewhere', () => {
    expect(navSection('/privacy')).toBeNull();
  });
});
