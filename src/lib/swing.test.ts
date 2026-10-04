import { describe, expect, it } from 'vitest';
import { SWING_MAX_DEG, stepSwing } from './swing';

describe('stepSwing', () => {
  it('rests at zero when nothing pushes it', () => {
    expect(stepSwing({ angle: 0, vel: 0 }, 0, 1)).toEqual({ angle: 0, vel: 0 });
  });
  it('swings opposite to the camera’s acceleration', () => {
    expect(stepSwing({ angle: 0, vel: 0 }, 2, 1).angle).toBeLessThan(0);
  });
  it('never passes ±12°', () => {
    let s = { angle: 0, vel: 0 };
    for (let i = 0; i < 30; i++) s = stepSwing(s, -40, 1);
    expect(Math.abs(s.angle)).toBeLessThanOrEqual(SWING_MAX_DEG);
  });
  it('damps back to rest', () => {
    let s = { angle: 10, vel: 0 };
    for (let i = 0; i < 400; i++) s = stepSwing(s, 0, 1);
    expect(Math.abs(s.angle)).toBeLessThan(0.05);
  });
});
