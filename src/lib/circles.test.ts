import { describe, expect, it } from 'vitest';
import { questIndex, questPath } from './publicUrl';
import { arcDots, arcIndices, arcLook, BADGE_W, circlesCentre, circlesLayout, SIDE_MIN, type Arc } from './circles';

const left: Arc = { side: 'left', apex: { x: 100, y: 300 }, radius: 400, spacing: 76, item: 56 };

describe('the two circles (D-129)', () => {
  it('puts the chosen item at the apex, full size, on top', () => {
    const look = arcLook(3, 3, left);
    expect(look).toMatchObject({ x: 100, y: 300, scale: 1, opacity: 1, zIndex: 100 });
  });

  it('curves its neighbours away from the middle of the screen, smaller and fainter', () => {
    const below = arcLook(4, 3, left);
    const above = arcLook(2, 3, left);
    expect(below.y).toBeGreaterThan(300);
    expect(above.y).toBeLessThan(300);
    expect(below.x).toBeLessThan(100); // the left arc bends left, off the screen's edge
    expect(below.x).toBeCloseTo(above.x, 6);
    expect(below.scale).toBeCloseTo(0.7, 6);
    expect(arcLook(6, 3, left).scale).toBeLessThan(below.scale);
    expect(arcLook(6, 3, left).opacity).toBeLessThan(below.opacity);
    expect(arcLook(6, 3, left).zIndex).toBeLessThan(below.zIndex);
  });

  it('keeps neighbours one spacing apart along the arc, and turns smoothly between items', () => {
    const a = arcLook(4, 3, left);
    const chord = Math.hypot(a.x - 100, a.y - 300);
    expect(chord).toBeGreaterThan(74);
    expect(chord).toBeLessThan(76.01);
    const half = arcLook(3, 2.5, left);
    expect(half.y).toBeGreaterThan(300);
    expect(half.y).toBeLessThan(a.y);
  });

  it('mirrors the right arc and bends the top and bottom ones up and down', () => {
    const right: Arc = { ...left, side: 'right', apex: { x: 700, y: 300 } };
    expect(arcLook(1, 0, right).x).toBeGreaterThan(700);
    const top: Arc = { ...left, side: 'top', apex: { x: 200, y: 60 } };
    const t = arcLook(1, 0, top);
    expect(t.x).toBeGreaterThan(200);
    expect(t.y).toBeLessThan(60);
    const bottom: Arc = { ...left, side: 'bottom', apex: { x: 200, y: 500 } };
    expect(arcLook(-1, 0, bottom).y).toBeGreaterThan(500);
  });

  it('renders the items around the position only', () => {
    expect(arcIndices(0, 3)).toEqual([0, 1, 2]);
    expect(arcIndices(10, 30)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(arcIndices(29.4, 30)).toEqual([25, 26, 27, 28, 29]);
    expect(arcIndices(0, 0)).toEqual([]);
  });

  it('draws the ring as dots inside the screen', () => {
    const dots = arcDots(left, 800, 600);
    expect(dots.length).toBeGreaterThan(20);
    expect(dots.every((d) => d.x >= 0 && d.y >= 0 && d.x < 800 && d.y < 600)).toBe(true);
    expect(dots.some((d) => d.x === 100 && d.y === 300)).toBe(true);
  });

  it('sits side by side on wide screens and top and bottom on narrow ones', () => {
    const wide = circlesLayout(SIDE_MIN, 576);
    expect(wide.mode).toBe('side');
    expect(wide.first.side).toBe('left');
    expect(wide.second.side).toBe('right');
    expect(wide.first.apex.y).toBe(wide.second.apex.y);
    expect(wide.second.apex.x).toBe(SIDE_MIN - wide.first.apex.x);
    const narrow = circlesLayout(320, 576);
    expect(narrow.mode).toBe('stack');
    expect(narrow.first.side).toBe('top');
    expect(narrow.second.side).toBe('bottom');
    expect(narrow.first.apex.x).toBe(160);
    expect(narrow.second.apex.y).toBeGreaterThan(narrow.first.apex.y);
  });

  it('fits the badge and the quest panel between the arcs, never over them', () => {
    for (const [w, h] of [[560, 576], [676, 576], [900, 576], [320, 576], [280, 576]] as const) {
      const l = circlesLayout(w, h);
      const c = circlesCentre(l, w);
      expect(c.badge.scale).toBeGreaterThanOrEqual(0.5);
      expect(c.badge.scale).toBeLessThanOrEqual(1);
      expect(c.badge.width).toBe(Math.round(BADGE_W * c.badge.scale));
      expect(c.panel.left).toBeGreaterThanOrEqual(c.badge.left + c.badge.width);
      expect(c.panel.left + c.panel.width).toBeLessThanOrEqual(l.mode === 'side' ? l.second.apex.x - l.second.item / 2 : w);
      if (l.mode === 'side') expect(c.badge.left).toBeGreaterThanOrEqual(l.first.apex.x + l.first.item / 2);
      else {
        expect(c.badge.top).toBeGreaterThan(l.first.apex.y + l.first.item / 2);
        expect(c.badge.top + c.badge.height).toBeLessThan(l.second.apex.y - l.second.item / 2);
      }
    }
    expect(circlesCentre(circlesLayout(900, 576), 900).badge.scale).toBe(1);
  });

  it('gives a quest its own address: by its id, or its place for a card from before project ids', () => {
    expect(questPath('ada', { id: 'p-1' }, 2)).toBe('/member/ada/quest/p-1');
    expect(questPath('ada', {}, 2)).toBe('/member/ada/quest/2');
    const withIds = [{ id: 'a' }, { id: 'b' }];
    expect(questIndex(withIds, 'b')).toBe(1);
    expect(questIndex(withIds, '2')).toBe(-1); // a card with ids is addressed by id
    expect(questIndex([{}, {}, {}], '3')).toBe(2);
    expect(questIndex([{}, {}], '3')).toBe(-1);
    expect(questIndex([{}], '0')).toBe(-1);
    expect(questIndex([{}], 'nope')).toBe(-1);
  });
});
