// Images live in Storage; rows hold only their path `<owner id>/<uuid>.<ext>` (D-027).
// A new file name on every upload keeps an approved card pointing at the image it was approved with.

import { requireSupabase } from './supabase';

export type ImageBucket = 'avatars' | 'project-covers';

export function publicImageUrl(bucket: ImageBucket, path: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (typeof base !== 'string' || !base) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** Uploads a WebP image into the owner's folder and returns its path for the database row. */
export async function uploadImage(bucket: ImageBucket, ownerId: string, image: Blob): Promise<string> {
  const path = `${ownerId}/${crypto.randomUUID()}.webp`;
  const { error } = await requireSupabase()
    .storage.from(bucket)
    .upload(path, image, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return path;
}
