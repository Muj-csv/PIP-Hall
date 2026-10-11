import { describe, expect, it } from 'vitest';
import { dragCam, frontIndex, inView, nextChapter, offsetOf, openAt, pagePose, settleTarget, STACK, stepPage, TURN_DEG } from './journal';

describe('the pages in view', () => {
  it('the front page first, then its neighbours outwards, a stack on each side', () => {
    const v = inView(10, 30);
    expect(v[0]).toEqual({ i: 10, off: 0 });
    expect(v.slice(1, 3).map((x) => x.i).sort((a, b) => a - b)).toEqual([9, 11]);
    expect(v.length).toBe(1 + 2 * STACK);
    for (const { off } of v) expect(Math.abs(off)).toBeLessThanOrEqual(STACK + 0.5);
  });

  it('a book has a first and a last page: no wrapping, and a short one shows what it has', () => {
    expect(inView(0, 30).every(({ i }) => i <= STACK)).toBe(true);
    expect(inView(0, 2).map((x) => x.i)).toEqual([0, 1]);
    expect(inView(0, 1)).toEqual([{ i: 0, off: 0 }]);
    expect(inView(0, 0)).toEqual([]);
    expect(frontIndex(-1, 5)).toBe(0);
    expect(frontIndex(9, 5)).toBe(4);
    expect(offsetOf(3, 1.5)).toBe(1.5);
  });
});

describe('poses', () => {
  it('the front page is flat and square, sharp at rest', () => {
    expect(pagePose(0, 300)).toEqual({ x: 0, y: 0, z: 0, rotate: 0, dim: 0, hidden: false });
  });

  it('a page leaving the front turns almost edge-on and steps back; the stacks mirror each other', () => {
    const r = pagePose(1, 300);
    const l = pagePose(-1, 300);
    expect(r.rotate).toBe(TURN_DEG);
    expect(l.rotate).toBe(-TURN_DEG);
    expect(r.x).toBeGreaterThan(150); // past the front page's edge
    expect(r.z).toBeLessThan(0);
    expect(l.x).toBe(-r.x);
  });

  it('further into a stack each page is a little further out and back, and darker', () => {
    const p2 = pagePose(2, 300);
    const p3 = pagePose(3, 300);
    expect(p3.x - p2.x).toBeGreaterThan(0);
    expect(p3.x - p2.x).toBeLessThan(40); // tight, like page edges
    expect(p3.z).toBeLessThan(p2.z);
    expect(p3.rotate).toBe(p2.rotate);
    expect(p3.dim).toBeGreaterThan(p2.dim);
    expect(pagePose(STACK + 1, 300).hidden).toBe(true);
  });

  it('half a turn is half way, and the page arcs over: lifted toward you, up a little, in shade', () => {
    const half = pagePose(0.5, 300);
    const landed = pagePose(1, 300);
    expect(half.rotate).toBe(TURN_DEG / 2);
    expect(half.z).toBeGreaterThan(landed.z / 2); // lifted, not slid flat
    expect(half.y).toBeLessThan(0);
    expect(landed.y).toBe(0);
    expect(half.dim).toBeGreaterThan(landed.dim / 2);
    expect(pagePose(-0.5, 300).y).toBe(half.y); // either way over
  });

  it('a closed book holds every page behind the front one; it opens in six hard steps', () => {
    const closed = pagePose(3, 300, 0);
    expect(closed.x).toBe(0);
    expect(closed.rotate).toBe(0);
    expect(closed.z).toBeLessThan(0);
    // Half open, a page's near edge stays behind the front page (z 0): it never cuts through it.
    for (const open of [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]) {
      for (const off of [1, 2, 4, -1, -3]) {
        const p = pagePose(off, 300, open);
        const near = p.z + 150 * Math.sin((Math.abs(p.rotate) * Math.PI) / 180);
        expect(near).toBeLessThan(0);
      }
    }
    expect(openAt(0)).toBe(0);
    expect(openAt(100)).toBeCloseTo(1 / 6);
    expect(openAt(360)).toBeCloseTo(0.5);
    expect(openAt(5000)).toBe(1);
  });
});

describe('turning', () => {
  it('a drag gives a little past the first and last page', () => {
    expect(dragCam(-1, 5)).toBeCloseTo(-0.58);
    expect(dragCam(6, 5)).toBeCloseTo(4.88);
    expect(dragCam(2.3, 5)).toBe(2.3);
  });

  it('a flick riffles on several pages; a slow release settles on the nearest', () => {
    expect(settleTarget(3.2, 0, 10)).toBe(3);
    expect(settleTarget(3.2, 0.01, 10)).toBe(6); // 0.01 per ms for 260 ms: about 2.6 on
    expect(settleTarget(3.2, -0.01, 10)).toBe(1);
    expect(settleTarget(8.6, 0.02, 10)).toBe(9); // stops at the last page
  });
});

describe('chapters', () => {
  it('go round from the last to the first', () => {
    expect(nextChapter(4, 1, 5)).toBe(0);
    expect(nextChapter(0, -1, 5)).toBe(4);
    expect(nextChapter(0, 1, 0)).toBe(0);
  });

  it('next and back page through the whole journal, on into the next chapter and back', () => {
    const sizes = [1, 3, 2];
    expect(stepPage(1, 0, 1, sizes)).toEqual({ chapter: 1, page: 1 });
    expect(stepPage(1, 2, 1, sizes)).toEqual({ chapter: 2, page: 0 });
    expect(stepPage(1, 0, -1, sizes)).toEqual({ chapter: 0, page: 0 });
    expect(stepPage(2, 0, -1, sizes)).toEqual({ chapter: 1, page: 2 });
    expect(stepPage(2, 1, 1, sizes)).toEqual({ chapter: 0, page: 0 }); // the end goes round to the start
    expect(stepPage(0, 0, -1, sizes)).toEqual({ chapter: 2, page: 1 });
    expect(stepPage(0, 0, 1, [])).toEqual({ chapter: 0, page: 0 });
  });
});
