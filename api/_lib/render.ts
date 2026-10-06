// Link-preview images and badge PNGs (D-095), drawn from the hall's own sprites and theme colours:
// satori lays out boxes and text, sharp turns the SVG into a PNG. Text is never invented: every
// word comes from the published card or exhibit.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import satori from 'satori';
import sharp from 'sharp';
import { avatarSpec } from '../../src/lib/avatar.js';
import { creditLine } from '../../src/lib/collab.js';
import { consoleFor } from '../../src/lib/museum.js';
import { avatarToSvg, paletteColors, spriteToSvg, svgDataUrl, themeColors } from '../../src/lib/spriteSvg.js';
import { CLIP_PALETTE, CONSOLE_NAMES, COVER_PALETTE, consoleArt, coverSprite, SPR, WORLD_OVERRIDES, WORLD_PALETTE, type SpriteMap } from '../../src/lib/sprites.js';
import type { PublishedCardRow } from '../../src/types/card.js';
import type { Exhibit } from '../../src/types/museum.js';
import { clip } from './meta.js';

// ---------------------------------------------------------------- assets (read once per instance)
const root = process.cwd();
const fontFile = (pkg: string, file: string) => readFileSync(join(root, 'node_modules/@fontsource', pkg, 'files', file));
let assets: { fonts: Parameters<typeof satori>[1]['fonts']; c: Record<string, string> } | null = null;

function load() {
  assets ??= {
    fonts: [
      { name: 'Jersey', data: fontFile('jersey-10', 'jersey-10-latin-400-normal.woff'), weight: 400 },
      { name: 'Jersey', data: fontFile('jersey-10', 'jersey-10-latin-ext-400-normal.woff'), weight: 400 },
      { name: 'Atkinson', data: fontFile('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-400-normal.woff'), weight: 400 },
      { name: 'Atkinson', data: fontFile('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-ext-400-normal.woff'), weight: 400 },
      { name: 'Atkinson', data: fontFile('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-700-normal.woff'), weight: 700 },
      { name: 'Atkinson', data: fontFile('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-ext-700-normal.woff'), weight: 700 },
      { name: 'Mono', data: fontFile('atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-400-normal.woff'), weight: 400 },
      { name: 'Mono', data: fontFile('atkinson-hyperlegible-mono', 'atkinson-hyperlegible-mono-latin-ext-400-normal.woff'), weight: 400 },
    ],
    c: themeColors(readFileSync(join(root, 'src/styles/theme.css'), 'utf8')),
  };
  return assets;
}
const col = (name: string): string => load().c[`--color-${name}`] ?? '#000000';

// ---------------------------------------------------------------- tiny element builder
type El = { type: string; props: Record<string, unknown> };
type Child = El | string | null | false;
const h = (type: string, style: Record<string, unknown>, ...children: Child[]): El => ({
  type,
  props: { style: type === 'div' ? { display: 'flex', ...style } : style, children: children.filter((c): c is El | string => Boolean(c)) },
});
const img = (src: string, width: number, height: number, style: Record<string, unknown> = {}): El => ({ type: 'img', props: { src, width, height, style } });
const pngUrl = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;

function sprite(map: SpriteMap, palette: Record<string, string>, scale: number, style: Record<string, unknown> = {}): El {
  const svg = spriteToSvg(map, paletteColors(palette, load().c));
  return img(svgDataUrl(svg), (map[0]?.length ?? 0) * scale, map.length * scale, style);
}
const world = (name: keyof typeof SPR) => ({ ...WORLD_PALETTE, ...(WORLD_OVERRIDES[name] ?? {}) });
const repeatX = (map: SpriteMap, times: number): SpriteMap => map.map((row) => row.repeat(times));

export async function toPng(input: Buffer, width?: number, height?: number): Promise<Buffer> {
  const s = sharp(input);
  return (width && height ? s.resize(width, height, { fit: 'cover' }) : s).png().toBuffer();
}

async function render(el: El, width: number, height: number): Promise<Buffer> {
  const svg = await satori(el as never, { width, height, fonts: load().fonts });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// ---------------------------------------------------------------- shared pieces
/** The DAY level as a backdrop: sky, two clouds, the ground strip. */
function scene(width: number, height: number, ...children: Child[]): El {
  const groundTimes = Math.ceil(width / 80) + 1;
  return h(
    'div',
    { position: 'relative', width, height, background: col('card-sky') },
    sprite(SPR.cloud, world('cloud'), 6, { position: 'absolute', left: width * 0.42, top: 26 }),
    sprite(SPR.cloud, world('cloud'), 4, { position: 'absolute', left: width * 0.8, top: 96 }),
    sprite(repeatX(SPR.ground, groundTimes), world('ground'), 8, { position: 'absolute', left: 0, bottom: 0 }),
    ...children,
  );
}

function photoOrAvatar(card: PublishedCardRow, photo: Buffer | null, w: number, hgt: number): El {
  if (photo) return img(pngUrl(photo), w, hgt);
  const svg = avatarToSvg(avatarSpec(card.username), {
    ink: col('card-ink'),
    body: load().c[avatarSpec(card.username).bodyToken] ?? col('card-avatar-1'),
    eye: col('card-face'),
    bg: col('card-sky'),
  });
  const side = Math.floor(Math.min(w, hgt) / 10) * 10;
  return h('div', { width: w, height: hgt, background: col('card-sky'), alignItems: 'center', justifyContent: 'center' }, img(svgDataUrl(svg), side, side));
}

/** The photo window of a badge drawn `width` wide (fetch photos at exactly this size). */
export function photoBox(width: number): { w: number; h: number } {
  const u = width / 400;
  return { w: Math.round(width - 68 * u), h: Math.round(170 * u) };
}
export const OG_BADGE = 380;
export const PNG_BADGE = 720;

/** The badge front: holder, band, photo window, name, handle, role, skills, optional QR. */
function badge(card: PublishedCardRow, photo: Buffer | null, width: number, qr: string | null = null): El {
  const u = width / 400;
  const c = card.card;
  const no = `No.${String(card.member_no).padStart(3, '0')}`;
  const chips = c.skills.slice(0, 3);
  return h(
    'div',
    { flexDirection: 'column', width, padding: 12 * u, background: col('card-frame'), border: `${4 * u}px solid ${col('card-ink')}`, boxShadow: `${8 * u}px ${8 * u}px 0 ${col('card-ink')}` },
    h(
      'div',
      { justifyContent: 'space-between', alignItems: 'center', padding: `${6 * u}px ${12 * u}px`, background: col('card-band'), border: `${3 * u}px solid ${col('card-ink')}` },
      h('div', { fontFamily: 'Jersey', fontSize: 34 * u, color: col('card-ink') }, 'PIP-HALL'),
      h('div', { fontFamily: 'Mono', fontSize: 18 * u, color: col('card-ink') }, no),
    ),
    h(
      'div',
      { flexDirection: 'column', marginTop: 10 * u, padding: 12 * u, background: col('card-face'), border: `${3 * u}px solid ${col('card-ink')}` },
      h('div', { border: `${3 * u}px solid ${col('card-ink')}` }, photoOrAvatar(card, photo, photoBox(width).w, photoBox(width).h)),
      h('div', { marginTop: 10 * u, fontFamily: 'Jersey', fontSize: 42 * u, lineHeight: 1, color: col('card-ink') }, clip(c.full_name, 22)),
      h('div', { marginTop: 4 * u, fontFamily: 'Mono', fontSize: 18 * u, color: col('card-plum') }, `@${card.username}`),
      c.role ? h('div', { marginTop: 4 * u, fontFamily: 'Atkinson', fontSize: 19 * u, color: col('card-ink') }, clip(c.role, 40)) : null,
      chips.length > 0 &&
        h(
          'div',
          { marginTop: 10 * u, gap: 6 * u, flexWrap: 'wrap' },
          ...chips.map((s) =>
            h('div', { padding: `${2 * u}px ${8 * u}px`, background: col('card-cream'), border: `${2 * u}px solid ${col('card-ink')}`, fontFamily: 'Atkinson', fontWeight: 700, fontSize: 15 * u, color: col('card-ink') }, clip(s, 18)),
          ),
        ),
      qr &&
        h(
          'div',
          { marginTop: 14 * u, alignItems: 'center', gap: 14 * u },
          img(svgDataUrl(qr), 128 * u, 128 * u),
          h(
            'div',
            { flexDirection: 'column', fontFamily: 'Atkinson', fontSize: 18 * u, color: col('card-ink') },
            h('div', { fontFamily: 'Jersey', fontSize: 30 * u }, 'SCAN ME'),
            h('div', {}, 'Meet me in PIP-Hall'),
          ),
        ),
    ),
  );
}

function qrSvg(value: string): string {
  const s = renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 256, level: 'M', marginSize: 2, fgColor: col('card-ink'), bgColor: col('card-face') }));
  return s.includes('xmlns=') ? s : s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

const textCol = (...children: Child[]) => h('div', { position: 'absolute', flexDirection: 'column', left: 500, top: 64, width: 640 }, ...children);
const kicker = (s: string) => h('div', { fontFamily: 'Jersey', fontSize: 32, color: col('card-plum') }, s);
const pip = () => sprite(SPR.pipIdle, world('pipIdle'), 8, { position: 'absolute', right: 70, bottom: 92 });

// ---------------------------------------------------------------- the four images
export async function memberOg(card: PublishedCardRow, photo: Buffer | null): Promise<Buffer> {
  const c = card.card;
  const facts = [`${c.projects.length} ${c.projects.length === 1 ? 'project' : 'projects'}`, c.github_username ? 'GitHub verified' : null].filter(Boolean).join(' · ');
  return render(
    scene(
      1200,
      630,
      h('div', { position: 'absolute', left: 70, top: 34 }, badge(card, photo, OG_BADGE)),
      textCol(
        kicker('PIXENDO · PIP-HALL'),
        h('div', { marginTop: 8, fontFamily: 'Jersey', fontSize: 84, lineHeight: 1, color: col('card-ink') }, clip(c.full_name, 24)),
        c.role || c.tagline ? h('div', { marginTop: 14, fontFamily: 'Atkinson', fontSize: 32, color: col('card-ink') }, clip((c.tagline || c.role)!, 70)) : null,
        c.skills.length > 0 && h('div', { marginTop: 16, fontFamily: 'Atkinson', fontWeight: 700, fontSize: 28, color: col('card-ink') }, clip(c.skills.slice(0, 5).join(' · '), 60)),
        h('div', { marginTop: 10, fontFamily: 'Atkinson', fontSize: 26, color: col('card-plum') }, facts),
      ),
      pip(),
    ),
    1200,
    630,
  );
}

export async function exhibitOg(e: Exhibit, picture: Buffer | null): Promise<Buffer> {
  const kind = consoleFor(e.project_id, e.console);
  const art = consoleArt(kind);
  const aw = art.sprite[0]!.length;
  const ah = art.sprite.length;
  const scale = Math.max(1, Math.floor(Math.min(440 / aw, 470 / ah)));
  const left = 60 + Math.floor((440 - aw * scale) / 2);
  const top = 538 - ah * scale; // stand on the ground
  const sw = art.screen.w * scale;
  const sh = art.screen.h * scale;
  const screen = picture ? img(pngUrl(picture), sw, sh) : sprite(coverSprite(e.project.title), COVER_PALETTE, sw / 32);
  const makers = (e.project.collaborators ?? []).map((m) => m.full_name);
  return render(
    scene(
      1200,
      630,
      sprite(art.sprite, art.palette, scale, { position: 'absolute', left, top }),
      h('div', { position: 'absolute', left: left + art.screen.x * scale, top: top + art.screen.y * scale, width: sw, height: sh, overflow: 'hidden' }, screen),
      h('div', { position: 'absolute', left: left + art.led.x * scale, top: top + art.led.y * scale, width: art.led.w * scale, height: art.led.h * scale, background: col('console-led') }),
      textCol(
        kicker(`PIXENDO MUSEUM · ON A ${CONSOLE_NAMES[kind].toUpperCase()}`),
        h('div', { marginTop: 8, fontFamily: 'Jersey', fontSize: 76, lineHeight: 1, color: col('card-ink') }, clip(e.project.title, 28)),
        e.project.description ? h('div', { marginTop: 14, fontFamily: 'Atkinson', fontSize: 30, color: col('card-ink') }, clip(e.project.description, 110)) : null,
        h('div', { marginTop: 16, fontFamily: 'Atkinson', fontWeight: 700, fontSize: 28, color: col('card-ink') }, clip(`Made by ${e.full_name}${makers.length ? ` with ${creditLine(makers)}` : ''}`, 70)),
        e.project.language ? h('div', { marginTop: 8, fontFamily: 'Atkinson', fontSize: 26, color: col('card-plum') }, e.project.language) : null,
      ),
    ),
    1200,
    630,
  );
}

export async function hallOg(players: number | null): Promise<Buffer> {
  const blocks = [0, 1, 2, 3].map((i) => sprite(SPR.block, { ...WORLD_PALETTE }, 8, { position: 'absolute', top: 0, left: 220 + i * 220 }));
  return render(
    scene(
      1200,
      630,
      sprite(repeatX(SPR.brick, 16), world('brick'), 8, { position: 'absolute', left: 0, top: 0 }),
      ...blocks,
      h(
        'div',
        { position: 'absolute', left: 0, top: 150, width: 1200, flexDirection: 'column', alignItems: 'center' },
        h('div', { fontFamily: 'Jersey', fontSize: 150, lineHeight: 1, color: col('card-ink') }, 'PIP-HALL'),
        h('div', { marginTop: 8, fontFamily: 'Jersey', fontSize: 50, color: col('card-ink') }, 'Where every person has a place.'),
        h(
          'div',
          { marginTop: 18, fontFamily: 'Atkinson', fontSize: 30, color: col('card-plum') },
          players ? `Meet ${players} ${players === 1 ? 'player' : 'players'}: flip a badge to see what they build.` : 'Flip a badge to see what people build.',
        ),
      ),
      pip(),
    ),
    1200,
    630,
  );
}

/** The downloadable badge (1080×1350, a portrait post): lanyard, clip, badge with its QR. */
export async function badgePng(card: PublishedCardRow, photo: Buffer | null, memberUrl: string): Promise<Buffer> {
  return render(
    h(
      'div',
      { position: 'relative', width: 1080, height: 1350, background: col('bg'), flexDirection: 'column', alignItems: 'center' },
      h('div', { width: 60, height: 120, background: col('card-lanyard'), borderLeft: `6px solid ${col('card-ink')}`, borderRight: `6px solid ${col('card-ink')}` }),
      sprite(SPR.clip, CLIP_PALETTE, 12),
      h('div', { marginTop: 4 }, badge(card, photo, PNG_BADGE, qrSvg(`${memberUrl}?via=qr`))),
      h('div', { position: 'absolute', bottom: 40, fontFamily: 'Mono', fontSize: 26, color: col('card-plum') }, memberUrl.replace(/^https?:\/\//, '')),
    ),
    1080,
    1350,
  );
}
