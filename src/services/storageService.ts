// Turns stored image paths into public URLs (D-027). Rows hold `<owner id>/<uuid>.<ext>`,
// never a URL, so the approved image can't be swapped from outside Storage.

export type ImageBucket = 'avatars' | 'project-covers';

export function publicImageUrl(bucket: ImageBucket, path: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (typeof base !== 'string' || !base) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${encoded}`;
}
