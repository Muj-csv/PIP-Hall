// Photo and cover handling in the browser (FR-04): reject huge files before touching them,
// scale down to fit, re-encode as WebP (~80 quality). Uploads stay well under the 2 MB bucket limit.

export const MAX_INPUT_BYTES = 8 * 1024 * 1024;
export const AVATAR_MAX_PX = 512;
export const COVER_MAX_PX = 960;
export const WEBP_QUALITY = 0.8;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

export class ImageProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProblem';
  }
}

/** Largest size within `max` × `max` that keeps the aspect ratio; never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) throw new ImageProblem('That image has no size.');
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Checks a picked file before any decoding work. */
export function checkImageFile(file: { size: number; type: string }): void {
  if (!ACCEPTED.includes(file.type)) throw new ImageProblem('Use a JPG, PNG, WebP, GIF or AVIF image.');
  if (file.size > MAX_INPUT_BYTES) throw new ImageProblem('That image is over 8 MB. Pick a smaller one.');
}

/** Decodes, scales to fit `max` and returns a WebP blob. Browser only. */
export async function toWebp(file: File, max: number): Promise<Blob> {
  checkImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageProblem('That file couldn’t be read as an image.');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageProblem('This browser can’t resize images.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
  if (!blob || blob.type !== 'image/webp') throw new ImageProblem('This browser can’t save WebP images. Try another browser.');
  return blob;
}
