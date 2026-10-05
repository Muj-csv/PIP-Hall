// Photo and cover handling in the browser (FR-04): reject huge files before touching them,
// scale down to fit, re-encode as WebP (JPEG on Safari). Uploads stay well under the 2 MB bucket limit.

// Phone cameras (48-50 MP) can save photos over 15 MB. They're shrunk before upload anyway.
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const AVATAR_MAX_PX = 512;
export const COVER_MAX_PX = 960;
export const WEBP_QUALITY = 0.8;
export const JPEG_QUALITY = 0.85;

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

export interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** Frees the decoded pixels. Call once you're finished with the image. */
  done: () => void;
}

/** Checks and decodes a picked file, the right way up. Browser only. */
export async function decodeImage(file: File): Promise<DecodedImage> {
  checkImageFile(file);
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

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Draws part of an image onto a canvas and saves it as WebP, or JPEG where WebP can't be saved. */
async function draw(
  decoded: DecodedImage,
  from: { x: number; y: number; w: number; h: number },
  out: { width: number; height: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageProblem('This browser can’t resize images.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.image, from.x, from.y, from.w, from.h, 0, 0, out.width, out.height);

  const webp = await toBlob(canvas, 'image/webp', WEBP_QUALITY);
  if (webp?.type === 'image/webp') return webp;

  // Safari (so every iPhone browser) can't save WebP. JPEG has no transparency, so put white behind it.
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, out.width, out.height);
  const jpeg = await toBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  if (jpeg?.type === 'image/jpeg') return jpeg;
  throw new ImageProblem('This browser can’t resize images. Try another browser.');
}

/** Saves the chosen part of a decoded image at the given size. */
export function cropImage(
  decoded: DecodedImage,
  crop: { x: number; y: number; w: number; h: number },
  out: { width: number; height: number },
): Promise<Blob> {
  return draw(decoded, crop, out);
}

/** Decodes, scales the whole image to fit `max` and saves it. Browser only. */
export async function shrinkImage(file: File, max: number): Promise<Blob> {
  const decoded = await decodeImage(file);
  try {
    return await draw(decoded, { x: 0, y: 0, w: decoded.width, h: decoded.height }, fitWithin(decoded.width, decoded.height, max));
  } finally {
    decoded.done();
  }
}
