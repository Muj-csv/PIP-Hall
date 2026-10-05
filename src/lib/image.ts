// Photo and cover handling in the browser (FR-04): reject huge files before touching them,
// scale down to fit, re-encode as WebP (~80 quality). Uploads stay well under the 2 MB bucket limit.

// Phone cameras (48-50 MP) can save photos over 15 MB. They're shrunk before upload anyway.
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const AVATAR_MAX_PX = 512;
export const COVER_MAX_PX = 960;
export const WEBP_QUALITY = 0.8;

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
  // Some phone galleries leave the type empty, so let the decoder decide those.
  if (file.type && (!file.type.startsWith('image/') || file.type === 'image/svg+xml')) {
    throw new ImageProblem('Pick a photo or an image file.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageProblem(`That image is over ${MAX_INPUT_BYTES / 1024 / 1024} MB. Pick a smaller one.`);
  }
}

export function isHeic(file: { name: string; type: string }): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  done: () => void;
}

async function decode(file: File): Promise<Decoded> {
  try {
    // from-image keeps phone photos the right way up.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    // Fall back to <img>: Safari opens more formats this way, HEIC included.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageProblem(
      isHeic(file)
        ? 'This browser can’t open HEIC photos. Pick a JPG or PNG, or upload a screenshot of the photo.'
        : 'That file couldn’t be read as an image.',
    );
  }
}

/** Decodes, scales to fit `max` and returns a WebP blob. Browser only. */
export async function toWebp(file: File, max: number): Promise<Blob> {
  checkImageFile(file);
  const decoded = await decode(file);
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageProblem('This browser can’t resize images.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    if (!blob || blob.type !== 'image/webp') throw new ImageProblem('This browser can’t save WebP images. Try another browser.');
    return blob;
  } finally {
    decoded.done();
  }
}
