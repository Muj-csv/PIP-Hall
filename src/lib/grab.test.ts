import { describe, expect, it } from 'vitest';
import { grabAngle, stepHeld } from './grab';
import { SWING_MAX_DEG, stepSwing } from './swing';

describe('grab and fling', () => {
  it('leans the badge toward the drag, never past the swing limit', () => {
    expect(grabAngle(0)).toBe(0);
    expect(grabAngle(30)).toBeGreaterThan(0);
    expect(grabAngle(-30)).toBeLessThan(0);
    expect(grabAngle(10_000)).toBe(SWING_MAX_DEG);
    expect(grabAngle(-10_000)).toBe(-SWING_MAX_DEG);
  });

  it('follows the finger smoothly and carries its speed into the fling', () => {
    let s = { angle: 0, vel: 0 };
    s = stepHeld(s, 60, 1);
    expect(s.angle).toBeGreaterThan(0);
    expect(s.angle).toBeLessThan(grabAngle(60));
    expect(s.vel).toBeGreaterThan(0);
  });

  it('comes back to rest after a fling', () => {
    let s = { angle: SWING_MAX_DEG, vel: -2 };
    for (let i = 0; i < 600; i++) s = stepSwing(s, 0, 1);
    expect(Math.abs(s.angle)).toBeLessThan(0.05);
  });
});
