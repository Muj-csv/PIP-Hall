import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_PX, COVER_MAX_PX, ImageProblem, MAX_INPUT_BYTES, checkImageFile, fitWithin, isHeic } from './image';

describe('fitWithin', () => {
  it('scales a large landscape photo down to 512 on the long side (avatar)', () => {
    expect(fitWithin(4032, 3024, AVATAR_MAX_PX)).toEqual({ width: 512, height: 384 });
  });
  it('scales a portrait photo by its height', () => {
    expect(fitWithin(3000, 4000, AVATAR_MAX_PX)).toEqual({ width: 384, height: 512 });
  });
  it('fits covers to 960', () => {
    expect(fitWithin(1920, 1080, COVER_MAX_PX)).toEqual({ width: 960, height: 540 });
  });
  it('never scales a small image up', () => {
    expect(fitWithin(300, 200, AVATAR_MAX_PX)).toEqual({ width: 300, height: 200 });
  });
  it('keeps at least 1px on a very thin image', () => {
    expect(fitWithin(10000, 3, AVATAR_MAX_PX)).toEqual({ width: 512, height: 1 });
  });
  it('rejects an image with no size', () => {
    expect(() => fitWithin(0, 100, 512)).toThrow(ImageProblem);
  });
});

describe('checkImageFile', () => {
  it('accepts common photo types up to 20 MB', () => {
    expect(MAX_INPUT_BYTES).toBe(20 * 1024 * 1024);
    expect(() => checkImageFile({ size: MAX_INPUT_BYTES, type: 'image/jpeg' })).not.toThrow();
    expect(() => checkImageFile({ size: 1000, type: 'image/png' })).not.toThrow();
  });
  it('lets phone photos through to the decoder: HEIC, and files with no type', () => {
    expect(() => checkImageFile({ size: 1000, type: 'image/heic' })).not.toThrow();
    expect(() => checkImageFile({ size: 1000, type: '' })).not.toThrow();
  });
  it('rejects files over 20 MB before decoding them', () => {
    expect(() => checkImageFile({ size: MAX_INPUT_BYTES + 1, type: 'image/jpeg' })).toThrow(/20 MB/);
  });
  it('rejects things that are not images', () => {
    expect(() => checkImageFile({ size: 10, type: 'image/svg+xml' })).toThrow(ImageProblem);
    expect(() => checkImageFile({ size: 10, type: 'application/pdf' })).toThrow(ImageProblem);
  });
});

describe('isHeic', () => {
  it('spots HEIC by type or file name', () => {
    expect(isHeic({ name: 'a.jpg', type: 'image/heic' })).toBe(true);
    expect(isHeic({ name: 'IMG_0001.HEIC', type: '' })).toBe(true);
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
  });
});
