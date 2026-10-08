// Link previews, OG images and badge PNGs (D-095), against a fake Supabase. No network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import samples from '../../src/data/sample-cards.json';
import type { PublishedCardRow } from '../../src/types/card';
import { GET as badge } from '../badge';
import { CRAWLER_PATTERN, PREVIEW_CRAWLERS, clip, previewHtml } from './meta';
import { GET as og } from '../og';
import { GET as preview, metaFor } from '../preview';
import { guard, StageError } from './guard';

const SB = 'https://pip-test.supabase.co';
const ORIGIN = 'https://pip-hall.example';
const PID = '00000000-0000-4000-8000-00000000f001';
const OWNER = '00000000-0000-4000-8000-000000000001';
const ada: PublishedCardRow = {
  ...(samples[0] as unknown as PublishedCardRow),
  username: 'ada',
  member_no: 42,
  card: {
    ...(samples[0] as unknown as PublishedCardRow).card,
    full_name: 'Ada <Lovelace> & "Co"',
    role: 'Builder of engines',
    avatar_path: `${OWNER}/11111111-1111-4111-8111-111111111111.webp`,
    skills: ['Python', 'React', 'Supabase'],
  },
};
const exhibitRow = {
  project_id: PID,
  username: 'ada',
  full_name: 'Ada Lovelace',
  avatar_path: null,
  member_no: 42,
  featured: false,
  console: 'tv',
  project: { ...ada.card.projects[0]!, id: PID, title: 'Tide Tables', description: 'Ocean data for surfers', github_url: 'https://github.com/ada/tide', collaborators: [{ username: 'bee', full_name: 'Bee Ng', member_no: 2 }] },
};
let webp: Buffer;
const asked: string[] = [];
/** What the public badge RPCs answer (V2-13); empty unless a test fills them. */
const rpc: Record<string, unknown[]> = { hall_titles: [], hall_awards: [], card_pins: [] };
const out = process.env.SHARE_SHOTS; // set to a folder to save the images for a look

beforeAll(async () => {
  webp = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#BC2051' } }).webp().toBuffer();
  process.env.VITE_SUPABASE_URL = SB;
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
  process.env.VITE_PUBLIC_ORIGIN = ORIGIN;
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    asked.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.startsWith(`${SB}/rest/v1/published_cards?select=profile_id,username`)) {
      if (url.includes('username=eq.sample-player-1')) return Response.json([samples[0]]);
      return Response.json(url.includes('username=eq.ada') ? [ada] : []);
    }
    if (url === `${SB}/rest/v1/published_cards?select=profile_id`) return Response.json([{ profile_id: 'a' }, { profile_id: 'b' }]);
    if (url === `${SB}/rest/v1/rpc/museum_exhibits`) return Response.json([exhibitRow]);
    const fn = /\/rest\/v1\/rpc\/(hall_titles|hall_awards|card_pins)$/.exec(url)?.[1];
    if (fn) return Response.json(rpc[fn]);
    if (url.startsWith(`${SB}/storage/v1/object/public/`)) return new Response(new Uint8Array(webp), { headers: { 'Content-Type': 'image/webp' } });
    if (url.startsWith('https://opengraph.githubassets.com/')) return new Response('nope', { status: 404 });
    return new Response('not found', { status: 404 });
  });
});
afterEach(() => {
  asked.length = 0;
});

async function image(res: Response, name: string) {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  const buf = Buffer.from(await res.arrayBuffer());
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/${name}.png`, buf);
  }
  return { buf, meta: await sharp(buf).metadata() };
}

describe('link previews (D-095)', () => {
  it('vercel.json sends exactly the preview crawlers to the preview function, before the app', () => {
    const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; has?: { value: string }[]; destination: string }[] };
    const routed = cfg.rewrites.filter((r) => r.has);
    expect(routed.map((r) => r.source)).toEqual(['/member/:username', '/museum/:id', '/museum', '/']);
    for (const r of routed) {
      expect(r.has![0]!.value).toBe(CRAWLER_PATTERN);
      expect(r.destination).toMatch(/^\/api\/preview\?path=/);
    }
    expect(cfg.rewrites.at(-1)!.destination).toBe('/index.html'); // the app's catch-all comes last
    const re = new RegExp(CRAWLER_PATTERN);
    expect(re.test('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)')).toBe(true); // Messenger
    expect(re.test('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)')).toBe(true);
    expect(re.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(re.test('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(false); // search engines render the app
    expect(PREVIEW_CRAWLERS.length).toBeGreaterThan(10);
  });

  it('a member link shows their published name, role and skills, escaped', async () => {
    const res = await preview(new Request(`${ORIGIN}/api/preview?path=/member/ada`));
    const html = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<meta property="og:title" content="Ada &lt;Lovelace&gt; &amp; &quot;Co&quot; · PIP-Hall">');
    expect(html).toContain('content="Builder of engines — Python · React · Supabase"');
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/api/og?member=ada">`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/member/ada">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toContain('<Lovelace>');
  });

  it('only reads published data: one read of published_cards, no drafts', async () => {
    await metaFor('/member/ada', ORIGIN);
    expect(asked).toEqual([`GET ${SB}/rest/v1/published_cards?select=profile_id,username,card,is_featured,published_at,member_no&username=eq.ada&limit=1`]);
    expect(asked.join()).not.toMatch(/profiles|projects\?/);
  });

  it('an unknown member, a bad username or the home page get the hall card', async () => {
    for (const path of ['/member/nobody', '/member/../../etc', '/', '/privacy']) {
      const m = await metaFor(path, ORIGIN);
      expect(m.title).toBe('PIP-Hall');
      expect(m.image).toBe(`${ORIGIN}/api/og`);
    }
  });

  it('an exhibit link credits its makers', async () => {
    const m = await metaFor(`/museum/${PID}`, ORIGIN);
    expect(m.title).toBe('Tide Tables · PIP-Hall Museum');
    expect(m.description).toBe('Ocean data for surfers Made by Ada Lovelace with Bee Ng.');
    expect(m.image).toBe(`${ORIGIN}/api/og?exhibit=${PID}`);
  });

  it('clips long text on a word boundary', () => {
    expect(clip('one two three four', 12)).toBe('one two…');
    expect(clip('short', 12)).toBe('short');
    expect(previewHtml({ title: 'a', description: 'b', url: 'u', image: 'i', imageAlt: 'x' })).toMatch(/^<!doctype html>/);
  });
});

describe('preview images and the badge PNG (D-095)', () => {
  it('draws a 1200×630 member image with their photo converted from WebP', async () => {
    const { meta } = await image(await og(new Request(`${ORIGIN}/api/og?member=ada`)), 'og-member');
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(asked.some((a) => a.includes('/storage/v1/object/public/avatars/'))).toBe(true);
  }, 20000);

  it('draws an exhibit on its console, and survives GitHub having no preview', async () => {
    const { meta } = await image(await og(new Request(`${ORIGIN}/api/og?exhibit=${PID}`)), 'og-exhibit');
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(asked).toContain('GET https://opengraph.githubassets.com/1/ada/tide');
  }, 20000);

  it('falls back to the hall image for anything unknown', async () => {
    const res = await og(new Request(`${ORIGIN}/api/og?member=nobody`));
    const { meta } = await image(res, 'og-hall');
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(res.headers.get('cache-control')).toContain('s-maxage=600');
  }, 20000);

  it('exports an approved badge as a 1080×1350 download with its QR', async () => {
    const res = await badge(new Request(`${ORIGIN}/api/badge?u=ada`));
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="pip-hall-ada.png"');
    const { meta } = await image(res, 'badge');
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
  }, 20000);

  it('draws a sample card with its generated pixel avatar (no photo)', async () => {
    const { meta } = await image(await og(new Request(`${ORIGIN}/api/og?member=sample-player-1`)), 'og-sample');
    expect(meta.width).toBe(1200);
    await image(await badge(new Request(`${ORIGIN}/api/badge?u=sample-player-1`)), 'badge-sample');
    expect(asked.some((a) => a.includes('/storage/'))).toBe(false);
  }, 20000);

  it('carries the title worn on its plate, the ribbons won and the admin badges, read from public data (V2-13)', async () => {
    const plain = (await image(await badge(new Request(`${ORIGIN}/api/badge?u=ada`)), 'badge-plain')).buf;
    rpc.hall_titles = [{ profile_id: ada.profile_id, earned: ['card_holder', 'mentor'], title: 'mentor', plate_style: { plate: 'plum', ink: 'cream' } }];
    rpc.hall_awards = [{ profile_id: ada.profile_id, awards: [{ place: 1 }, { place: null, name: 'Best UI' }] }];
    rpc.card_pins = [{ profile_id: ada.profile_id, pins: [{ key: 'helper', name: 'Helper', gem: 'heart', tone: 'red' }] }];
    asked.length = 0;
    const { buf, meta } = await image(await badge(new Request(`${ORIGIN}/api/badge?u=ada`)), 'badge-extras');
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
    expect(buf.equals(plain)).toBe(false);
    for (const fn of ['hall_titles', 'hall_awards', 'card_pins']) expect(asked).toContain(`POST ${SB}/rest/v1/rpc/${fn}`);
    expect(asked.join()).not.toMatch(/profiles|projects\?|card_appearance/); // public functions only
    rpc.hall_titles = [];
    rpc.hall_awards = [];
    rpc.card_pins = [];
  }, 20000);

  it('a failure says which step broke, in a header, and never the details (V2-13, #23)', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await guard(async () => {
      throw new StageError('fonts', new Error('ENOENT: /var/task/node_modules/@fontsource/x.woff'));
    })(new Request(`${ORIGIN}/api/og`));
    expect(res.status).toBe(500);
    expect(res.headers.get('x-piphall-stage')).toBe('fonts');
    expect(await res.text()).not.toMatch(/ENOENT|var\/task/);
    const other = await guard(async () => {
      throw new Error('boom');
    })(new Request(`${ORIGIN}/api/badge?u=ada`));
    expect(other.headers.get('x-piphall-stage')).toBe('unknown');
    expect(quiet).toHaveBeenCalledTimes(2);
    quiet.mockRestore();
  });

  it('refuses a badge for someone with no approved card', async () => {
    const res = await badge(new Request(`${ORIGIN}/api/badge?u=nobody`));
    expect(res.status).toBe(404);
  });
});
