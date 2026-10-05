// Grab and fling (D-082): press and hold the current badge, then drag sideways to swing it on its
// lanyard; let go and the pendulum takes over. A quick drag still browses and a tap still flips.

import { SWING_MAX_DEG } from './swing';
import type { SwingState } from './swing';

/** How long a press must stay still before it grabs the badge. */
export const GRAB_HOLD_MS = 350;
/** CSS px of sideways drag per degree of swing. */
const PX_PER_DEG = 6;
/** How fast a held badge follows the finger (fraction of the gap closed per frame). */
const FOLLOW = 0.45;

/** The angle a held badge leans to for a sideways drag of dx CSS px. */
export function grabAngle(dx: number): number {
  return Math.max(-SWING_MAX_DEG, Math.min(SWING_MAX_DEG, dx / PX_PER_DEG));
}

/** One frame of a held badge easing toward the finger. Its velocity is what flings on release. */
export function stepHeld(s: SwingState, dx: number, dt: number): SwingState {
  const target = grabAngle(dx);
  const angle = s.angle + (target - s.angle) * Math.min(1, FOLLOW * dt);
  return { angle, vel: (angle - s.angle) / Math.max(dt, 0.01) };
}
