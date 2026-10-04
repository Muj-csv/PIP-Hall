// Generated member avatar: a symmetric 10 × 10 sprite seeded from the handle (brief §10, §16).
// Pure and deterministic, so the same handle always draws the same face.

export const AVATAR_SIZE = 10;
export const AVATAR_BODY_TOKENS = [
  '--color-card-avatar-1',
  '--color-card-avatar-2',
  '--color-card-avatar-3',
  '--color-card-avatar-4',
  '--color-card-avatar-5',
] as const;

export interface AvatarPixel {
  x: number;
  y: number;
  /** 'outline' pixels sit above the body line; 'body' pixels are filled with the body colour. */
  kind: 'outline' | 'body' | 'eye';
}

export interface AvatarSpec {
  bodyToken: (typeof AVATAR_BODY_TOKENS)[number];
  pixels: AvatarPixel[];
}

/** FNV-1a over UTF-16 code units. */
export function hashHandle(handle: string): number {
  let h = 2166136261;
  for (let i = 0; i < handle.length; i++) {
    h ^= handle.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function avatarSpec(handle: string): AvatarSpec {
  let h = hashHandle(handle);
  const bodyToken = AVATAR_BODY_TOKENS[h % AVATAR_BODY_TOKENS.length] ?? AVATAR_BODY_TOKENS[0];
  const rnd = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const pixels: AvatarPixel[] = [];
  for (let y = 1; y < 9; y++) {
    for (let col = 1; col < 5; col++) {
      const p = y < 3 ? 0.42 : y > 6 ? 0.62 : 0.58;
      if (rnd() < p) {
        const kind = y >= 4 ? 'body' : 'outline';
        pixels.push({ x: col, y, kind }, { x: AVATAR_SIZE - 1 - col, y, kind });
      }
    }
  }
  pixels.push({ x: 3, y: 4, kind: 'eye' }, { x: 6, y: 4, kind: 'eye' });
  return { bodyToken, pixels };
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  spec: AvatarSpec,
  colors: { ink: string; body: string; eye: string },
): void {
  ctx.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  for (const p of spec.pixels) {
    ctx.fillStyle = p.kind === 'eye' ? colors.eye : p.kind === 'body' ? colors.body : colors.ink;
    ctx.fillRect(p.x, p.y, 1, 1);
  }
}
