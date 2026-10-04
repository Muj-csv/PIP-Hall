// Draws the PWA icons from the PIXENDO block sprite (the same art as public/favicon.svg) onto the
// bezel colour, at exact pixel multiples so edges stay crisp. Run: node scripts/make-icons.mjs
// Colours are the design tokens color.bezel and the card block palette (docs/design/tokens.json).
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync('docs/design/tokens.json', 'utf8'));
const find = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
const val = (path) => {
  const t = find(tokens, path);
  const v = t?.$value ?? t?.value ?? t;
  return typeof v === 'object' && v ? (v.light ?? v.default ?? Object.values(v)[0]) : v;
};
const BG = val('color.bezel');

// The 10×10 block sprite from favicon.svg (ink frame, highlight, face, shade, glyph).
const BLOCK = readFileSync('public/favicon.svg', 'utf8').match(/<path[^>]+>/g).join('');

/** size: output px; scale: block width as a share of the icon (maskable keeps it in the safe zone). */
function svg(size, scale) {
  const cell = Math.floor((size * scale) / 10);
  const off = Math.floor((size - cell * 10) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
<rect width="${size}" height="${size}" fill="${BG}"/>
<g transform="translate(${off} ${off}) scale(${cell})">${BLOCK}</g></svg>`;
}

const OUT = [
  ['public/pwa-192.png', 192, 0.75],
  ['public/pwa-512.png', 512, 0.75],
  ['public/maskable-512.png', 512, 0.55],
  ['public/apple-touch-icon.png', 180, 0.7],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, scale] of OUT) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size, scale)}</body></html>`);
  await page.locator('svg').screenshot({ path: file, omitBackground: false });
  console.log('wrote', file);
}
await browser.close();
