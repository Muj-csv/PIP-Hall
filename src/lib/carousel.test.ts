import { describe, expect, it } from 'vitest';
import {
  EDGE_OVERSHOOT,
  FLICK_SPEED,
  SLOT_SPACING,
  clampIndex,
  releaseTarget,
  rubberBand,
  slotLook,
  stepCamera,
  visibleIndices,
} from './carousel';

describe('clampIndex', () => {
  it('keeps the index inside the list', () => {
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(2.4, 5)).toBe(2);
    expect(clampIndex(2.6, 5)).toBe(3);
  });
  it('is 0 for an empty list', () => {
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe('releaseTarget', () => {
  it('snaps to the nearest slot after a slow drag', () => {
    expect(releaseTarget(SLOT_SPACING * 1.4, 1, 0, 6)).toBe(1);
    expect(releaseTarget(SLOT_SPACING * 1.6, 1, 0, 6)).toBe(2);
  });
  it('moves exactly one slot on a flick, whatever the distance', () => {
    const fast = FLICK_SPEED + 0.1;
    expect(releaseTarget(SLOT_SPACING * 1.1, 1, -fast, 6)).toBe(2); // flick left → next card
    expect(releaseTarget(SLOT_SPACING * 0.9, 1, fast, 6)).toBe(0); // flick right → previous card
  });
  it('never leaves the list', () => {
    expect(releaseTarget(SLOT_SPACING * 6, 5, -2, 6)).toBe(5);
    expect(releaseTarget(-SLOT_SPACING, 0, 2, 6)).toBe(0);
  });
});

describe('rubberBand', () => {
  it('is linear inside the list', () => {
    expect(rubberBand(SLOT_SPACING * 2, 5)).toBe(SLOT_SPACING * 2);
  });
  it('resists past the ends', () => {
    const min = -SLOT_SPACING * EDGE_OVERSHOOT;
    expect(rubberBand(min - 100, 5)).toBeCloseTo(min - 30);
    const max = (4 + EDGE_OVERSHOOT) * SLOT_SPACING;
    expect(rubberBand(max + 100, 5)).toBeCloseTo(max + 30);
  });
});

describe('visibleIndices', () => {
  it('renders only the current card and two on each side', () => {
    expect(visibleIndices(5, 300)).toEqual([3, 4, 5, 6, 7]);
    expect(visibleIndices(0, 300)).toEqual([0, 1, 2]);
    expect(visibleIndices(299, 300)).toEqual([297, 298, 299]);
    expect(visibleIndices(0, 0)).toEqual([]);
  });
});

describe('slotLook', () => {
  it('shows the current card full size on top', () => {
    const look = slotLook(3, SLOT_SPACING * 3);
    expect(look).toMatchObject({ dx: 0, scale: 1, opacity: 1, zIndex: 100 });
  });
  it('shrinks neighbours to 0.84 and fades them 12% per slot', () => {
    const look = slotLook(4, SLOT_SPACING * 3);
    expect(look.scale).toBeCloseTo(0.84);
    expect(look.opacity).toBeCloseTo(0.88);
    expect(look.zIndex).toBeLessThan(100);
  });
});

describe('stepCamera', () => {
  it('settles exactly on the target', () => {
    let s = { cam: 0, vel: 0 };
    for (let i = 0; i < 600; i++) s = stepCamera(s.cam, s.vel, SLOT_SPACING, 1);
    expect(s).toEqual({ cam: SLOT_SPACING, vel: 0 });
  });
});
