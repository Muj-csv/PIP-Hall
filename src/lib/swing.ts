// Lanyard swing (brief §7, §15): each badge is a pendulum on its clip, pushed by the camera's
// acceleration. α = −0.09θ − 0.14ω − 0.9·a_cam; ω × 0.86 per frame; θ clamped to ±12°.

export interface SwingState {
  /** Angle in degrees. */
  angle: number;
  /** Angular velocity in degrees per frame. */
  vel: number;
}

export const SWING_MAX_DEG = 12;

export function stepSwing(s: SwingState, camAcc: number, dt: number): SwingState {
  const acc = -s.angle * 0.09 - s.vel * 0.14 - camAcc * 0.9;
  const vel = (s.vel + acc * dt) * Math.pow(0.86, dt);
  const angle = Math.max(-SWING_MAX_DEG, Math.min(SWING_MAX_DEG, s.angle + vel * dt));
  return { angle, vel };
}
