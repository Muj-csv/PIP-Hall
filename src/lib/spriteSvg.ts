// Pixel art as SVG (D-095): the server draws link-preview images and badge PNGs from the same
// original sprites the hall uses. Pure (no DOM), so it runs in Vercel functions and tests.

import { AVATAR_SIZE, type AvatarSpec } from './avatar.js';
import type { Palette, SpriteMap } from './sprites.js';

/** `--color-x` → `#hex`, from the generated theme.css. The first value wins: that's the DAY theme. */
export function themeColors(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--color-[\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1]!] ??= m[2]!;
  return out;
}

/** A palette's keys resolved to colours. Unknown variables are left out (drawn transparent). */
export function paletteColors(palette: Palette, theme: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, cssVar] of Object.entries(palette)) {
    const c = theme[cssVar];
    if (c) out[key] = c;
  }
  return out;
}

/** The rects of a sprite, one per horizontal run of the same colour. */
export function spriteRects(map: SpriteMap, colors: Readonly<Record<string, string>>): { x: number; y: number; w: number; fill: string }[] {
  const rects: { x: number; y: number; w: number; fill: string }[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const fill = colors[row[x]!];
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return rects;
}

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${body}</svg>`;
}

/** A sprite as a standalone SVG, one unit per pixel (scale it up where it's placed). */
export function spriteToSvg(map: SpriteMap, colors: Readonly<Record<string, string>>): string {
  const w = map[0]?.length ?? 0;
  const body = spriteRects(map, colors)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  return svg(w, map.length, body);
}

/** The generated member avatar (avatar.ts) as SVG, on a solid background. */
export function avatarToSvg(spec: AvatarSpec, colors: { ink: string; body: string; eye: string; bg: string }): string {
  const body = spec.pixels
    .map((p) => `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="${p.kind === 'eye' ? colors.eye : p.kind === 'body' ? colors.body : colors.ink}"/>`)
    .join('');
  return svg(AVATAR_SIZE, AVATAR_SIZE, `<rect width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" fill="${colors.bg}"/>${body}`);
}

/** An SVG string as a data URL, for <img> in the image renderer. */
export function svgDataUrl(s: string): string {
  return `data:image/svg+xml;base64,${btoa(s)}`;
}
