// Pictures drawn in the browser (D-095, D-104): the badge PNG and the showcase's posters (V2-12).
// The same drawings as the server's (lib/shareArt.ts), laid out by satori and painted on a canvas.
// Loaded only when someone presses a Save button: satori, the fonts and the QR code stay out of the
// hall's first load.

import yogaWasm from 'satori/yoga.wasm?url';
import harfbuzzWasm from 'harfbuzzjs/hb.wasm?url';
import jerseyLatin from '@fontsource/jersey-10/files/jersey-10-latin-400-normal.woff?url';
import jerseyExt from '@fontsource/jersey-10/files/jersey-10-latin-ext-400-normal.woff?url';
import atkinson400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff?url';
import atkinson400Ext from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-400-normal.woff?url';
import atkinson700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff?url';
import atkinson700Ext from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-700-normal.woff?url';
import monoLatin from '@fontsource/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-400-normal.woff?url';
import monoExt from '@fontsource/atkinson-hyperlegible-mono/files/atkinson-hyperlegible-mono-latin-ext-400-normal.woff?url';
import themeCss from '../styles/theme.css?raw';
import { ART_FONTS, shareArt, type El } from '../lib/shareArt';
import { themeColors } from '../lib/spriteSvg';

const FONT_URLS: Record<string, string> = {
  'jersey-10-latin-400-normal.woff': jerseyLatin,
  'jersey-10-latin-ext-400-normal.woff': jerseyExt,
  'atkinson-hyperlegible-next-latin-400-normal.woff': atkinson400,
  'atkinson-hyperlegible-next-latin-ext-400-normal.woff': atkinson400Ext,
  'atkinson-hyperlegible-next-latin-700-normal.woff': atkinson700,
  'atkinson-hyperlegible-next-latin-ext-700-normal.woff': atkinson700Ext,
  'atkinson-hyperlegible-mono-latin-400-normal.woff': monoLatin,
  'atkinson-hyperlegible-mono-latin-ext-400-normal.woff': monoExt,
};

type Satori = typeof import('satori/standalone');

// satori brings two WebAssembly engines: yoga (layout) and harfbuzz (text). Both look for their
// .wasm next to the page, where there is none. Yoga takes its file through init(). Harfbuzz starts
// loading itself when satori is imported and finishes during the first drawing, so until that
// drawing is done, its request (and only its) is pointed at our own copy.
let engine: Promise<Satori['default']> | null = null;
let restoreFetch: (() => void) | null = null;
const loadSatori = () =>
  (engine ??= (async () => {
    const original = window.fetch;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return original(/(^|\/)hb\.wasm(\?|$)/.test(url) ? harfbuzzWasm : input, init);
    };
    restoreFetch = () => {
      window.fetch = original;
      restoreFetch = null;
    };
    const mod: Satori = await import('satori/standalone');
    const res = await original(yogaWasm);
    if (!res.ok) throw new Error(`yoga.wasm: ${res.status}`);
    await mod.init(await res.arrayBuffer());
    return mod.default;
  })().catch((e: unknown) => {
    engine = null;
    restoreFetch?.();
    throw e;
  }));

let fonts: Promise<Parameters<Satori['default']>[1]['fonts']> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all(
    ART_FONTS.map(async (f) => {
      const res = await fetch(FONT_URLS[f.file]!);
      if (!res.ok) throw new Error(`font ${f.file}: ${res.status}`);
      return { name: f.name, weight: f.weight, data: await res.arrayBuffer() };
    }),
  ).catch((e: unknown) => {
    fonts = null; // try again next time
    throw e;
  }));

const decode = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image did not decode'));
    img.src = url;
  });

/** An image cropped to fill w×h (like CSS cover), as a PNG data URL; null when it can't be read. */
export async function coverDataUrl(url: string | null, w: number, h: number): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const img = await decode(await res.blob());
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight); // cover
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    canvas.getContext('2d')!.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    URL.revokeObjectURL(img.src);
    return canvas.toDataURL('image/png');
  } catch {
    return null; // no picture: the drawing falls back to the hall's own pixel art
  }
}

/** The theme's drawings (lib/shareArt.ts), with its colours. */
export const art = () => shareArt(themeColors(themeCss));

/** Lays out a drawing with satori and paints it as a PNG of `size`. */
export async function renderPng(draw: (a: ReturnType<typeof art>) => El, size: { width: number; height: number }): Promise<Blob> {
  const [satori, fontData] = await Promise.all([loadSatori(), loadFonts()]);
  let svg: string;
  try {
    svg = await satori(draw(art()) as never, { ...size, fonts: fontData });
  } finally {
    restoreFetch?.(); // harfbuzz is loaded by now (or failed): fetch goes back to normal
  }
  const img = await decode(new Blob([svg], { type: 'image/svg+xml' }));
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas gave no PNG'))), 'image/png'));
}

/** Hands a PNG to the browser as a download. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
