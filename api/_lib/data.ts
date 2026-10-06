// Published data for link previews and images (D-095). Reads only what any visitor can read
// (published_cards, museum_exhibits) with the public anon key. Never drafts, never writes.

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
