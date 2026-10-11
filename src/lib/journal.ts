// The Journal (V2-24, D-137): the Museum's exhibits as the pages of a flip-book journal, each room a
// chapter. The page in front lies flat and large; the pages already turned stack on the left and the
// pages to come on the right, each turned almost edge-on and set back, so they read as the edges of an
// open book. Pure geometry and gesture math, unit-tested; the view (components/museum/JournalBook)
// only writes what this works out.
//
// Units: the camera is measured in pages (1 = one page along), so the spring, a drag and the keys all
// speak the same number. Sizes are in multiples of the front page's width F. A book has a first page
// and a last: it never wraps round.

import { awardLine } from './museumWalk';
import type { ShowcaseStop } from './showcase';

/** How far a page turns as it leaves the front (degrees), and how far it steps back (in F). */
export const TURN_DEG = 70;
export const DEPTH_F = 0.5;
/** The first page of a stack stands just past the front page's edge; each next one a little further. */
export const FIRST_F = 0.7;
export const STACK_F = 0.08;
export const STACK_DEPTH_F = 0.02;
/** The perspective, in F. */
export const PERSPECTIVE_F = 2.6;
/** Pages kept in each stack (past that they would turn their backs). */
export const STACK = 6;
/** Pointer travel (CSS px) before a press counts as a turn rather than a tap. */
export const TURN_THRESHOLD_PX = 6;
/** How far a flick carries on, in ms of its release speed (a riffle through the pages). */
export const MOMENTUM_MS = 260;

const clampPage = (i: number, count: number) => Math.max(0, Math.min(count - 1, i));

/** Where page i sits relative to the camera, in pages (negative: in the left stack, already turned). */
export const offsetOf = (i: number, cam: number): number => i - cam;

/** The page nearest the camera. */
export function frontIndex(cam: number, count: number): number {
  return count <= 0 ? 0 : clampPage(Math.round(cam), count);
}

/** The pages to keep in the page (DOM), nearest first, each with its offset from the camera. */
export function inView(cam: number, count: number): { i: number; off: number }[] {
  const out: { i: number; off: number }[] = [];
  if (count <= 0) return out;
  const front = frontIndex(cam, count);
  for (let d = 0; d <= STACK + 1; d++) {
    for (const i of d === 0 ? [front] : [front - d, front + d]) {
      if (i < 0 || i >= count) continue;
      const off = offsetOf(i, cam);
      if (Math.abs(off) > STACK + 0.5) continue;
      out.push({ i, off });
    }
  }
  return out;
}

export interface PagePose {
  /** Sideways and depth offsets of the page's centre from the front page's, in px. */
  x: number;
  z: number;
  /** Its turn about the vertical axis, in degrees (positive: its outer, right edge goes back). */
  rotate: number;
  /** 0 in front, rising toward the ends of the stacks: how much shade falls on it. */
  dim: number;
  /** Past the end of its stack: not drawn. */
  hidden: boolean;
}

/**
 * A page's pose for the front page width F (px). `open` (0..1) is how far the book has opened: at 0
 * every page lies closed behind the front one, and the stacks fan out as it rises (arriving).
 */
export function pagePose(off: number, frontWidth: number, open = 1): PagePose {
  const a = Math.abs(off);
  const s = Math.sign(off);
  const t = Math.min(a, 1); // leaving the front
  const rest = Math.max(0, a - 1); // further into the stack
  const tidy = (n: number, by: number) => Math.round(n * by) / by + 0; // + 0: never -0
  const x = s * (t * FIRST_F + rest * STACK_F) * frontWidth * open;
  const z = -(t * DEPTH_F + rest * STACK_DEPTH_F) * frontWidth * open - (1 - open) * a * 2;
  return {
    x: tidy(x, 10),
    z: tidy(z, 10),
    rotate: tidy(s * t * TURN_DEG * open, 100),
    dim: Math.min(1, t * 0.35 + rest * 0.11),
    hidden: a > STACK + 0.5,
  };
}

/** The stage's perspective (px) for the front page width. */
export const perspectiveFor = (frontWidth: number): number => Math.round(PERSPECTIVE_F * frontWidth);

/** Drag distance (CSS px) that turns one page. */
export const pxPerPage = (frontWidth: number): number => Math.max(48, Math.round(frontWidth * 0.5));

/** The camera while dragging: it gives a little past the first and last page, and pulls back. */
export function dragCam(cam: number, count: number): number {
  if (count <= 0) return cam;
  const min = -0.4;
  const max = count - 1 + 0.4;
  if (cam < min) return min + (cam - min) * 0.3;
  if (cam > max) return max + (cam - max) * 0.3;
  return cam;
}

/** Where a turn settles when let go: a flick riffles on with its release speed (pages per ms) for
 *  MOMENTUM_MS, then the book rests open at the nearest page. */
export function settleTarget(cam: number, speed: number, count: number): number {
  if (count <= 0) return 0;
  return clampPage(Math.round(cam + speed * MOMENTUM_MS), count);
}

/** How open the book is, `ms` after it starts opening (0..1, in six hard steps). */
export function openAt(ms: number, duration = 720): number {
  return Math.min(1, Math.ceil(Math.max(0, ms / duration) * 6) / 6);
}

/** The next chapter on or back, round from the last to the first and back. */
export function nextChapter(i: number, d: 1 | -1, chapters: number): number {
  if (chapters <= 0) return 0;
  return (((i + d) % chapters) + chapters) % chapters;
}

/**
 * One page on or back through the whole journal: within the chapter, or on into the next chapter's
 * first page (back into the previous chapter's last), round from the end to the start. A presenter's
 * clicker only ever says "next" and "back".
 */
export function stepPage(chapter: number, page: number, d: 1 | -1, sizes: readonly number[]): { chapter: number; page: number } {
  if (!sizes.length) return { chapter: 0, page: 0 };
  const n = sizes[chapter] ?? 0;
  if (page + d >= 0 && page + d < n) return { chapter, page: page + d };
  const c = nextChapter(chapter, d, sizes.length);
  return { chapter: c, page: d > 0 ? 0 : Math.max(0, (sizes[c] ?? 1) - 1) };
}

/** What a screen reader hears for a page. */
export function stopLabel(s: ShowcaseStop, i: number, count: number): string {
  const e = s.exhibit;
  if (e.portrait) return `${e.full_name}, featured member, page ${i + 1} of ${count}`;
  return `${e.project.title}, page ${i + 1} of ${count}${s.awards.length ? `, ${awardLine(s.awards[0]!)}` : ''}`;
}
