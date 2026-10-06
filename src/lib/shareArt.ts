// The pictures PIP-Hall makes of itself (D-095): link-preview images and the downloadable badge.
// This file only lays them out as satori elements from the hall's own sprites and theme colours,
// so the same drawing runs on the server (api/_lib/render.ts, link previews) and in the browser
// (lib/badgeExport.ts, Save badge). Text is never invented: every word comes from the published
// card or exhibit. Images come in as data URLs.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import type { PublishedCardRow } from '../types/card.js';
import type { Exhibit } from '../types/museum.js';
import { avatarSpec } from './avatar.js';
import { clip } from './clip.js';
import { creditLine } from './collab.js';
import { consoleFor } from './museum.js';
import { avatarToSvg, paletteColors, spriteToSvg, svgDataUrl } from './spriteSvg.js';
import { CLIP_PALETTE, CONSOLE_NAMES, COVER_PALETTE, consoleArt, coverSprite, SPR, WORLD_OVERRIDES, WORLD_PALETTE, type SpriteMap } from './sprites.js';

/** The font files the pictures use, by satori family name (from @fontsource, `.woff`). */
export const ART_FONTS = [
  { name: 'Jersey', pkg: 'jersey-10', file: 'jersey-10-latin-400-normal.woff', weight: 400 },
  { name: 'Jersey', pkg: 'jersey-10', file: 'jersey-10-latin-ext-400-normal.woff', weight: 400 },
  { name: 'Atkinson', pkg: 'atkinson-hyperlegible-next', file: 'atkinson-hyperlegible-next-latin-400-normal.woff', weight: 400 },
  { name: 'Atkinson', pkg: 'atkinson-hyperlegible-next', file: 'atkinson-hyperlegible-next-latin-ext-400-normal.woff', weight: 400 },
  { name: 'Atkinson', pkg: 'atkinson-hyperlegible-next', file: 'atkinson-hyperlegible-next-latin-700-normal.woff', weight: 700 },
  { name: 'Atkinson', pkg: 'atkinson-hyperlegible-next', file: 'atkinson-hyperlegible-next-latin-ext-700-normal.woff', weight: 700 },
  { name: 'Mono', pkg: 'atkinson-hyperlegible-mono', file: 'atkinson-hyperlegible-mono-latin-400-normal.woff', weight: 400 },
  { name: 'Mono', pkg: 'atkinson-hyperlegible-mono', file: 'atkinson-hyperlegible-mono-latin-ext-400-normal.woff', weight: 400 },
] as const;

export type El = { type: string; props: Record<string, unknown> };
type Child = El | string | null | false;

/** The photo window of a badge drawn `width` wide (fetch photos at exactly this size). */
export function photoBox(width: number): { w: number; h: number } {
  const u = width / 400;
  return { w: Math.round(width - 68 * u), h: Math.round(170 * u) };
}
export const OG_BADGE = 380;
export const PNG_BADGE = 720;
export const PNG_SIZE = { width: 1080, height: 1350 } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Every picture, drawn with the theme's colours (`--color-*` → hex, from theme.css). */
export function shareArt(colors: Readonly<Record<string, string>>) {
  const col = (name: string): string => colors[`--color-${name}`] ?? '#000000';

  // ---- tiny element builder
  const h = (type: string, style: Record<string, unknown>, ...children: Child[]): El => ({
    type,
    props: { style: type === 'div' ? { display: 'flex', ...style } : style, children: children.filter((c): c is El | string => Boolean(c)) },
  });
  const img = (src: string, width: number, height: number, style: Record<string, unknown> = {}): El => ({ type: 'img', props: { src, width, height, style } });
  const sprite = (map: SpriteMap, palette: Record<string, string>, scale: number, style: Record<string, unknown> = {}): El =>
    img(svgDataUrl(spriteToSvg(map, paletteColors(palette, colors))), (map[0]?.length ?? 0) * scale, map.length * scale, style);
  const world = (name: keyof typeof SPR) => ({ ...WORLD_PALETTE, ...(WORLD_OVERRIDES[name] ?? {}) });
  const repeatX = (map: SpriteMap, times: number): SpriteMap => map.map((row) => row.repeat(times));

  /** The DAY level as a backdrop: sky, two clouds, the ground strip. */
  const scene = (width: number, height: number, ...children: Child[]): El =>
    h(
      'div',
      { position: 'relative', width, height, background: col('card-sky') },
      sprite(SPR.cloud, world('cloud'), 6, { position: 'absolute', left: width * 0.42, top: 26 }),
      sprite(SPR.cloud, world('cloud'), 4, { position: 'absolute', left: width * 0.8, top: 96 }),
      sprite(repeatX(SPR.ground, Math.ceil(width / 80) + 1), world('ground'), 8, { position: 'absolute', left: 0, bottom: 0 }),
      ...children,
    );

  const photoOrAvatar = (card: PublishedCardRow, photo: string | null, w: number, hgt: number): El => {
    if (photo) return img(photo, w, hgt);
    const spec = avatarSpec(card.username);
    const svg = avatarToSvg(spec, { ink: col('card-ink'), body: colors[spec.bodyToken] ?? col('card-avatar-1'), eye: col('card-face'), bg: col('card-sky') });
    const side = Math.floor(Math.min(w, hgt) / 10) * 10;
    return h('div', { width: w, height: hgt, background: col('card-sky'), alignItems: 'center', justifyContent: 'center' }, img(svgDataUrl(svg), side, side));
  };

  const qrSvg = (value: string): string => {
    const s = renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 256, level: 'M', marginSize: 2, fgColor: col('card-ink'), bgColor: col('card-face') }));
    return s.includes('xmlns=') ? s : s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  };

  /** The badge front: holder, band, photo window, name, handle, role, skills, optional QR. */
  const badge = (card: PublishedCardRow, photo: string | null, width: number, qr: string | null = null): El => {
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
  };

  const textCol = (...children: Child[]) => h('div', { position: 'absolute', flexDirection: 'column', left: 500, top: 64, width: 640 }, ...children);
  const kicker = (s: string) => h('div', { fontFamily: 'Jersey', fontSize: 32, color: col('card-plum') }, s);
  const pip = () => sprite(SPR.pipIdle, world('pipIdle'), 8, { position: 'absolute', right: 70, bottom: 92 });

  return {
    memberOg(card: PublishedCardRow, photo: string | null): El {
      const c = card.card;
      const facts = [`${c.projects.length} ${c.projects.length === 1 ? 'project' : 'projects'}`, c.github_username ? 'GitHub verified' : null].filter(Boolean).join(' · ');
      return scene(
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
      );
    },

    exhibitOg(e: Exhibit, picture: string | null): El {
      const kind = consoleFor(e.project_id, e.console);
      const art = consoleArt(kind);
      const aw = art.sprite[0]!.length;
      const ah = art.sprite.length;
      const scale = Math.max(1, Math.floor(Math.min(440 / aw, 470 / ah)));
      const left = 60 + Math.floor((440 - aw * scale) / 2);
      const top = 538 - ah * scale; // stand on the ground
      const sw = art.screen.w * scale;
      const sh = art.screen.h * scale;
      const screen = picture ? img(picture, sw, sh) : sprite(coverSprite(e.project.title), COVER_PALETTE, sw / 32);
      const makers = (e.project.collaborators ?? []).map((m) => m.full_name);
      return scene(
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
      );
    },

    hallOg(players: number | null): El {
      const blocks = [0, 1, 2, 3].map((i) => sprite(SPR.block, { ...WORLD_PALETTE }, 8, { position: 'absolute', top: 0, left: 220 + i * 220 }));
      return scene(
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
      );
    },

    /** The downloadable badge (1080×1350, a portrait post): lanyard, clip, badge with its QR. */
    badgePng(card: PublishedCardRow, photo: string | null, memberUrl: string): El {
      return h(
        'div',
        { position: 'relative', width: 1080, height: 1350, background: col('bg'), flexDirection: 'column', alignItems: 'center' },
        h('div', { width: 60, height: 120, background: col('card-lanyard'), borderLeft: `6px solid ${col('card-ink')}`, borderRight: `6px solid ${col('card-ink')}` }),
        sprite(SPR.clip, CLIP_PALETTE, 12),
        h('div', { marginTop: 4 }, badge(card, photo, PNG_BADGE, qrSvg(`${memberUrl}?via=qr`))),
        h('div', { position: 'absolute', bottom: 40, fontFamily: 'Mono', fontSize: 26, color: col('card-plum') }, memberUrl.replace(/^https?:\/\//, '')),
      );
    },
  };
}
