import { describe, expect, it } from 'vitest';
import { splashHoldMs } from './splash';

describe('splashHoldMs', () => {
  it('holds the power-on screen on the first visit of a session', () => {
    expect(splashHoldMs(true, false)).toBeGreaterThanOrEqual(1000);
  });
  it('is shorter with reduced motion, and only covers loading on reloads', () => {
    expect(splashHoldMs(true, true)).toBeLessThan(splashHoldMs(true, false));
    expect(splashHoldMs(false, false)).toBe(0);
  });
});
