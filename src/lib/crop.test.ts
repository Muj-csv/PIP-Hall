import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, PHOTO_ASPECT, clampCrop, initialCrop, moveCrop, outputSize, zoomCrop, zoomOf } from './crop';

const A = 2; // simple aspect for readable numbers

describe('initialCrop', () => {
  it('uses the full width of a tall photo, starting near the top where faces are', () => {
    expect(initialCrop(1000, 2000, A)).toEqual({ x: 0, y: 375, w: 1000, h: 500 });
  });
  it('uses the full height of a very wide photo, centred horizontally', () => {
    expect(initialCrop(4000, 1000, A)).toEqual({ x: 1000, y: 0, w: 2000, h: 1000 });
  });
});

describe('zoomCrop', () => {
  it('zooms around the centre of the box', () => {
    const c = zoomCrop({ x: 0, y: 750, w: 1000, h: 500 }, 1000, 2000, A, 2);
    expect(c).toEqual({ x: 250, y: 875, w: 500, h: 250 });
    expect(zoomOf(c, 1000, 2000, A)).toBe(2);
  });
  it('stays between 1 and the max zoom', () => {
    const start = initialCrop(1000, 2000, A);
    expect(zoomOf(zoomCrop(start, 1000, 2000, A, 0.2), 1000, 2000, A)).toBe(1);
    expect(zoomOf(zoomCrop(start, 1000, 2000, A, 99), 1000, 2000, A)).toBe(MAX_ZOOM);
  });
  it('zooming out near an edge pulls the box back inside the photo', () => {
    const corner = { x: 500, y: 1750, w: 500, h: 250 };
    expect(zoomCrop(corner, 1000, 2000, A, 1)).toEqual({ x: 0, y: 1500, w: 1000, h: 500 });
  });
});

describe('moveCrop', () => {
  it('moves the box and stops at the photo edges', () => {
    const c = { x: 250, y: 875, w: 500, h: 250 };
    expect(moveCrop(c, 1000, 2000, -100, 50)).toEqual({ x: 150, y: 925, w: 500, h: 250 });
    expect(moveCrop(c, 1000, 2000, -9999, 9999)).toEqual({ x: 0, y: 1750, w: 500, h: 250 });
  });
  it('clampCrop leaves a box that already fits alone', () => {
    const c = { x: 10, y: 10, w: 100, h: 50 };
    expect(clampCrop(c, 1000, 1000)).toEqual(c);
  });
});

describe('outputSize', () => {
  it('saves at 640 wide in the badge shape', () => {
    expect(outputSize({ x: 0, y: 0, w: 3000, h: 3000 / PHOTO_ASPECT }, PHOTO_ASPECT)).toEqual({ width: 640, height: 295 });
  });
  it('never scales a small crop up', () => {
    expect(outputSize({ x: 0, y: 0, w: 200, h: 100 }, A)).toEqual({ width: 200, height: 100 });
  });
});
