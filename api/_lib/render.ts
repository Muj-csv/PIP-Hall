// Link-preview images and badge PNGs (D-095) on the server: the drawing is shared with the browser
// (src/lib/shareArt.ts); here satori lays it out with fonts read from disk and sharp turns the SVG
// into a PNG. satori and sharp load on first use, so a missing engine (sharp is native) is reported
// as the step that failed (guard.ts) instead of crashing the function before it can answer.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type satoriType from 'satori';
import { ART_FONTS, OG_SIZE, PNG_SIZE, shareArt, type BadgeExtras, type El } from '../../src/lib/shareArt.js';
import { inStage } from './guard.js';
import { themeColors } from '../../src/lib/spriteSvg.js';
import type { PublishedCardRow } from '../../src/types/card.js';
import type { Exhibit } from '../../src/types/museum.js';

export { OG_BADGE, PNG_BADGE, photoBox } from '../../src/lib/shareArt.js';

// ---------------------------------------------------------------- assets (read once per instance)
const root = process.cwd();
let assets: { fonts: Parameters<typeof satoriType>[1]['fonts']; art: ReturnType<typeof shareArt> } | null = null;

const load = () =>
  inStage('fonts', () =>
    (assets ??= {
      fonts: ART_FONTS.map((f) => ({ name: f.name, weight: f.weight, data: readFileSync(join(root, 'node_modules/@fontsource', f.pkg, 'files', f.file)) })),
      art: shareArt(themeColors(readFileSync(join(root, 'src/styles/theme.css'), 'utf8'))),
    }),
  );
const sharpOf = () => inStage('png', async () => (await import('sharp')).default);
const satoriOf = () => inStage('layout', async () => (await import('satori')).default);

const pngUrl = (b: Buffer | null) => (b ? `data:image/png;base64,${b.toString('base64')}` : null);

export async function toPng(input: Buffer, width?: number, height?: number): Promise<Buffer> {
  const sharp = await sharpOf();
  return inStage('png', () => {
    const s = sharp(input);
    return (width && height ? s.resize(width, height, { fit: 'cover' }) : s).png().toBuffer();
  });
}

async function render(draw: (art: ReturnType<typeof shareArt>) => El, size: { width: number; height: number }): Promise<Buffer> {
  const { fonts, art } = await load();
  const [satori, sharp] = await Promise.all([satoriOf(), sharpOf()]);
  const svg = await inStage('layout', () => satori(draw(art) as never, { ...size, fonts }));
  return inStage('png', () => sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer());
}

// ---------------------------------------------------------------- the four images
export const memberOg = (card: PublishedCardRow, photo: Buffer | null) => render((a) => a.memberOg(card, pngUrl(photo)), OG_SIZE);
export const exhibitOg = (e: Exhibit, picture: Buffer | null) => render((a) => a.exhibitOg(e, pngUrl(picture)), OG_SIZE);
export const hallOg = (players: number | null) => render((a) => a.hallOg(players), OG_SIZE);
export const badgePng = (card: PublishedCardRow, photo: Buffer | null, memberUrl: string, extras: BadgeExtras = {}) =>
  render((a) => a.badgePng(card, pngUrl(photo), memberUrl, extras), PNG_SIZE);
