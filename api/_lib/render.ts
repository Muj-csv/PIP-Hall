// Link-preview images and badge PNGs (D-095) on the server: the drawing is shared with the browser
// (src/lib/shareArt.ts); here satori lays it out with fonts read from disk and sharp turns the SVG
// into a PNG.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { ART_FONTS, OG_SIZE, PNG_SIZE, shareArt, type El } from '../../src/lib/shareArt.js';
import { themeColors } from '../../src/lib/spriteSvg.js';
import type { PublishedCardRow } from '../../src/types/card.js';
import type { Exhibit } from '../../src/types/museum.js';

export { OG_BADGE, PNG_BADGE, photoBox } from '../../src/lib/shareArt.js';

// ---------------------------------------------------------------- assets (read once per instance)
const root = process.cwd();
let assets: { fonts: Parameters<typeof satori>[1]['fonts']; art: ReturnType<typeof shareArt> } | null = null;

function load() {
  assets ??= {
    fonts: ART_FONTS.map((f) => ({ name: f.name, weight: f.weight, data: readFileSync(join(root, 'node_modules/@fontsource', f.pkg, 'files', f.file)) })),
    art: shareArt(themeColors(readFileSync(join(root, 'src/styles/theme.css'), 'utf8'))),
  };
  return assets;
}

const pngUrl = (b: Buffer | null) => (b ? `data:image/png;base64,${b.toString('base64')}` : null);

export async function toPng(input: Buffer, width?: number, height?: number): Promise<Buffer> {
  const s = sharp(input);
  return (width && height ? s.resize(width, height, { fit: 'cover' }) : s).png().toBuffer();
}

async function render(el: El, size: { width: number; height: number }): Promise<Buffer> {
  const svg = await satori(el as never, { ...size, fonts: load().fonts });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// ---------------------------------------------------------------- the four images
export const memberOg = (card: PublishedCardRow, photo: Buffer | null) => render(load().art.memberOg(card, pngUrl(photo)), OG_SIZE);
export const exhibitOg = (e: Exhibit, picture: Buffer | null) => render(load().art.exhibitOg(e, pngUrl(picture)), OG_SIZE);
export const hallOg = (players: number | null) => render(load().art.hallOg(players), OG_SIZE);
export const badgePng = (card: PublishedCardRow, photo: Buffer | null, memberUrl: string) => render(load().art.badgePng(card, pngUrl(photo), memberUrl), PNG_SIZE);
