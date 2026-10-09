// Published data for link previews and images (D-095). Reads only what any visitor can read
// (published_cards, museum_exhibits) with the public anon key. Never drafts, never writes.

import type { BadgeExtras } from '../../src/lib/shareArt.js';
import { titleOf } from '../../src/lib/titles.js';
import type { PublishedCardRow } from '../../src/types/card.js';
import type { Exhibit } from '../../src/types/museum.js';

const USERNAME = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUsername = (u: string): boolean => USERNAME.test(u);
export const isProjectId = (id: string): boolean => UUID.test(id);

function env(): { url: string; key: string } | null {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/+$/, ''), key } : null;
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const e = env();
  if (!e) return null;
  try {
    const res = await fetch(`${e.url}${path}`, {
      ...init,
      headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // a preview without data still renders the hall card
  }
}

export async function memberCard(username: string): Promise<PublishedCardRow | null> {
  if (!isUsername(username)) return null;
  const rows = await rest<PublishedCardRow[]>(
    `/rest/v1/published_cards?select=profile_id,username,card,is_featured,published_at,member_no&username=eq.${encodeURIComponent(username)}&limit=1`,
  );
  return rows?.[0] ?? null;
}

export async function exhibit(projectId: string): Promise<Exhibit | null> {
  if (!isProjectId(projectId)) return null;
  const all = await rest<Exhibit[]>('/rest/v1/rpc/museum_exhibits', { method: 'POST', body: '{}' });
  return all?.find((e) => e.project_id === projectId) ?? null;
}

/** What the hall shows on a member's badge (V2-13): the title they wear on its plate, their
 *  ribbons and admin-made badges. All public (hall_titles, hall_awards, card_pins); each one that
 *  can't be read is simply left off. */
export async function badgeExtras(profileId: string): Promise<BadgeExtras> {
  const call = <T>(fn: string) => rest<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', body: '{}' });
  const [titles, awards, pins] = await Promise.all([
    call<{ profile_id: string; title: string | null; plate_style: { plate?: string; ink?: string } | null }[]>('hall_titles'),
    call<{ profile_id: string; awards: { place: number | null }[] }[]>('hall_awards'),
    call<{ profile_id: string; pins: { gem: string; tone: string }[] }[]>('card_pins'),
  ]);
  const worn = titles?.find((t) => t.profile_id === profileId);
  const named = titleOf(worn?.title);
  return {
    title: named ? { name: named.name, plate: worn?.plate_style?.plate ?? null, ink: worn?.plate_style?.ink ?? null } : null,
    ribbons: (awards?.find((a) => a.profile_id === profileId)?.awards ?? []).slice(0, 3).map((a) => (a.place && a.place >= 1 && a.place <= 3 ? (`p${a.place}` as 'p1' | 'p2' | 'p3') : 'award')),
    pins: (pins?.find((p) => p.profile_id === profileId)?.pins ?? []).slice(0, 3).map((p) => ({ gem: p.gem, tone: p.tone })),
  };
}

export async function hallSize(): Promise<number | null> {
  const rows = await rest<{ profile_id: string }[]>('/rest/v1/published_cards?select=profile_id');
  return rows ? rows.length : null;
}

/** A public Storage image as PNG bytes, or null. Photos are WebP, which the renderer can't draw. */
export async function storageImage(bucket: 'avatars' | 'project-covers', path: string | null, toPng: (b: Buffer) => Promise<Buffer>): Promise<Buffer | null> {
  const e = env();
  if (!e || !path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/i.test(path)) return null;
  return remoteImage(`${e.url}/storage/v1/object/public/${bucket}/${path}`, toPng);
}

/** Any image URL as PNG bytes (size-capped, short timeout), or null. */
export async function remoteImage(url: string, toPng: (b: Buffer) => Promise<Buffer>): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(png|jpeg|webp|gif)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 4 * 1024 * 1024 ? null : await toPng(buf);
  } catch {
    return null;
  }
}

/** The public origin for absolute links in previews. */
export function originOf(request: Request): string {
  const configured = process.env.VITE_PUBLIC_ORIGIN;
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}
