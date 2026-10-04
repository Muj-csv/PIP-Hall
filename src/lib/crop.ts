// Crop box math for the photo cropper. Everything is in the source image's pixels.

/** The badge photo window is 178 × 82 (see .photo-window in base.css). */
export const PHOTO_ASPECT = 178 / 82;
/** Saved photo size. Sharp on 3x phone screens, small enough to upload fast. */
export const PHOTO_OUT_WIDTH = 640;
export const MAX_ZOOM = 4;

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Widest box with this aspect that fits inside the image (zoom 1). */
export function widestCrop(iw: number, ih: number, aspect: number): number {
  return Math.min(iw, ih * aspect);
}

/** Keeps the box inside the image. */
export function clampCrop(c: Crop, iw: number, ih: number): Crop {
  return { ...c, x: clamp(c.x, 0, iw - c.w), y: clamp(c.y, 0, ih - c.h) };
}

/** Zoom 1, centred left to right. On tall photos it starts near the top, where faces usually are. */
export function initialCrop(iw: number, ih: number, aspect: number): Crop {
  const w = widestCrop(iw, ih, aspect);
  const h = w / aspect;
  return { x: (iw - w) / 2, y: (ih - h) * 0.25, w, h };
}

export function zoomOf(c: Crop, iw: number, ih: number, aspect: number): number {
  return widestCrop(iw, ih, aspect) / c.w;
}

/** Sets the zoom (1 to MAX_ZOOM) and keeps the centre of the box where it was. */
export function zoomCrop(c: Crop, iw: number, ih: number, aspect: number, zoom: number): Crop {
  const w = widestCrop(iw, ih, aspect) / clamp(zoom, 1, MAX_ZOOM);
  const h = w / aspect;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, iw, ih);
}

/** Moves the box by dx, dy source pixels. */
export function moveCrop(c: Crop, iw: number, ih: number, dx: number, dy: number): Crop {
  return clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, iw, ih);
}

/** Output size: PHOTO_OUT_WIDTH wide, or the crop's own size if smaller (never scaled up). */
export function outputSize(c: Crop, aspect: number): { width: number; height: number } {
  const width = Math.max(1, Math.round(Math.min(PHOTO_OUT_WIDTH, c.w)));
  return { width, height: Math.max(1, Math.round(width / aspect)) };
}
