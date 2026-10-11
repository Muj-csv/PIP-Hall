// The Journal's book (V2-24, D-137): a chapter's exhibits as the pages of an open flip book. The page
// in front lies flat and large; the pages already turned stack on the left, the pages to come on the
// right, almost edge-on (lib/journal.ts works out every pose). Arriving, and on each new chapter, the
// book opens: the stacks fan out from behind the front page in six hard steps. It turns on its own
// spring, on one requestAnimationFrame loop that writes only transforms (D-031) and sleeps at rest;
// React re-renders only when the page nearest the front changes.
// Interactive (the Museum): drag or swipe sideways to turn pages (a flick riffles on), a tap on a
// page in a stack turns to it, a tap on the front page opens it; it is a listbox, so the keyboard and
// screen readers get the same path. Without onTurn (the kiosk) it is a picture that follows `index`.

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { stepCamera } from '../../lib/carousel';
import { dragCam, frontIndex, inView, offsetOf, openAt, pagePose, perspectiveFor, pxPerPage, settleTarget, stopLabel, TURN_THRESHOLD_PX, type PagePose } from '../../lib/journal';
import { plaqueBy } from '../../lib/museumWalk';
import type { ShowcaseStop } from '../../lib/showcase';
import { PixelAvatar } from '../cards/PixelAvatar';
import { QuestArt } from '../circles/QuestArt';

interface Props {
  stops: readonly ShowcaseStop[];
  /** The page to bring to the front. */
  index: number;
  /** What the book holds (the chapter): a new one opens afresh at `index`. */
  scene?: string;
  reduce: boolean;
  /** The listbox's id and name (interactive only). */
  id?: string;
  label?: string;
  /** Turned by hand (a drag, a flick, a tap on a stacked page): the page it settles on. */
  onTurn?: (i: number) => void;
  /** One page on or back (arrow keys, Page Up and Down: what a presenter's clicker sends). */
  onStep?: (d: 1 | -1) => void;
  /** The front page was tapped, or Enter pressed. */
  onOpen?: () => void;
  /** Keys the book does not use itself (the chapters). */
  onKey?: (e: KeyboardEvent) => void;
}

/** How long the book takes to open (ms). */
const OPEN_MS = 720;

export function JournalBook({ stops, index, scene = '', reduce, id, label, onTurn, onStep, onOpen, onKey }: Props) {
  const count = stops.length;
  const interactive = Boolean(onTurn);
  const stage = useRef<HTMLDivElement>(null);
  const [front, setFront] = useState(0); // the front page's width (px), from the stage's size
  const cam = useRef({ x: index, v: 0, target: index, dragging: false });
  /** When the book began to open (performance.now()), or 0 once it is open. */
  const opening = useRef(reduce ? 0 : -1); // -1: opens on the first frame
  const [near, setNear] = useState(index); // the camera, rounded: which pages are in the DOM
  const openNow = useRef(reduce ? 1 : 0); // how open the book is now: pages that join take it
  // A new chapter opens square on its page; the stage itself stays, and keeps focus.
  const [shownScene, setShownScene] = useState(scene);
  if (shownScene !== scene) {
    setShownScene(scene);
    setNear(index);
  }
  const pages = useRef(new Map<number, HTMLElement>());
  /** Starts the loop if it is asleep (it sleeps whenever the book is at rest). */
  const wake = useRef(() => {});
  const live = useRef({ count, front, reduce, onTurn, onOpen });
  useEffect(() => {
    live.current = { count, front, reduce, onTurn, onOpen };
  });

  // One loop: open the book, step the spring, write each page's pose. At rest it sleeps (no frames
  // at all) until something wakes it: a turn, a drag, a new chapter, a new size.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let awake = false;
    const was = { x: NaN, front: 0, open: NaN, still: false, n: 0 };
    const frame = (now: number) => {
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      const c = cam.current;
      const l = live.current;
      if (!l.front) {
        awake = false;
        return;
      }
      if (opening.current === -1) opening.current = now;
      const open = opening.current ? openAt(now - opening.current, OPEN_MS) : 1;
      openNow.current = open;
      if (open >= 1 && opening.current) opening.current = 0;
      if (!c.dragging) {
        if (l.reduce) {
          c.x = c.target;
          c.v = 0;
        } else {
          const s = stepCamera(c.x, c.v, c.target, dt);
          c.x = s.cam;
          c.v = s.vel;
        }
      }
      const moved = Math.abs(c.x - was.x) > 0.0005 || open !== was.open || l.front !== was.front || pages.current.size !== was.n;
      if (moved) {
        for (const [i, el] of pages.current) {
          poseOn(el, pagePose(offsetOf(i, c.x), l.front, open));
        }
        const r = Math.round(c.x);
        setNear((n) => (n === r ? n : r));
      }
      stage.current?.toggleAttribute('data-opening', open < 1);
      const still = !moved && !c.dragging;
      if (still !== was.still) stage.current?.toggleAttribute('data-still', still);
      Object.assign(was, { x: c.x, front: l.front, open, still, n: pages.current.size });
      if (still && !opening.current) {
        awake = false; // at rest: sleep
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    wake.current = () => {
      if (awake) return;
      awake = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    wake.current();
    return () => {
      cancelAnimationFrame(raf);
      awake = false;
      wake.current = () => {};
    };
  }, []);

  const lastScene = useRef(scene);
  useLayoutEffect(() => {
    if (lastScene.current === scene) return;
    lastScene.current = scene;
    const c = cam.current;
    c.x = c.target = index;
    c.v = 0;
    opening.current = reduce ? 0 : -1;
    wake.current();
    // Only when the chapter changes; index changes are followed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);
  // The stage decides how big the front page is: it fits the height, and the open book fits the width.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      // The open book spans about two front pages; a page is about 0.86 of its width tall.
      const f = Math.floor(Math.max(96, Math.min(w * (w < 480 ? 0.56 : 0.46), (h * 0.84) / 0.86)) / 4) * 4; // the 4px grid
      setFront((x) => (x === f ? x : f));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Follow `index`.
  useEffect(() => {
    const c = cam.current;
    if (c.dragging) return;
    c.target = Math.max(0, Math.min(count - 1, index));
    if (reduce) {
      c.x = c.target;
      c.v = 0;
    }
    wake.current();
  }, [index, count, reduce]);
  useEffect(() => wake.current(), [front]);

  // Turning by hand: drag to turn, let go to settle (a flick riffles on); a press that never moved is a tap.
  const press = useRef({ x: 0, cam: 0, lastX: 0, lastT: 0, speed: 0, moved: false, target: null as Element | null });
  const onMove = useCallback((e: PointerEvent) => {
    const p = press.current;
    const c = cam.current;
    const dx = e.clientX - p.x;
    if (!p.moved && Math.abs(dx) <= TURN_THRESHOLD_PX) return;
    p.moved = true;
    c.dragging = true;
    wake.current();
    const per = pxPerPage(live.current.front);
    const now = performance.now();
    c.x = dragCam(p.cam - dx / per, live.current.count);
    c.v = 0;
    p.speed = -(e.clientX - p.lastX) / per / Math.max(1, now - p.lastT);
    p.lastX = e.clientX;
    p.lastT = now;
  }, []);
  const onUp = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    const p = press.current;
    const c = cam.current;
    const n = live.current.count;
    if (p.moved) {
      c.dragging = false;
      c.target = settleTarget(c.x, p.speed, n);
      wake.current();
      live.current.onTurn?.(frontIndex(c.target, n));
      return;
    }
    // A tap: the front page opens; a page in a stack is turned to.
    const hit = p.target?.closest<HTMLElement>('[data-i]');
    if (!hit) return;
    const i = Number(hit.dataset.i);
    if (i === frontIndex(c.target, n)) live.current.onOpen?.();
    else {
      c.target = i;
      wake.current();
      live.current.onTurn?.(i);
    }
  }, [onMove]);
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button > 0 || count === 0) return;
    const now = performance.now();
    press.current = { x: e.clientX, cam: cam.current.x, lastX: e.clientX, lastT: now, speed: 0, moved: false, target: e.target as Element };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    },
    [onMove, onUp],
  );

  // A sideways swipe on a trackpad (or shift and the wheel) turns one page at a time.
  useEffect(() => {
    const el = stage.current;
    if (!el || !interactive) return;
    let acc = 0;
    let quietUntil = 0;
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      const now = performance.now();
      if (now < quietUntil) return;
      acc += dx;
      if (Math.abs(acc) < 40) return;
      const n = live.current.count;
      const c = cam.current;
      const at = frontIndex(c.target, n);
      const next = frontIndex(c.target + (acc > 0 ? 1 : -1), n);
      acc = 0;
      quietUntil = now + 140;
      if (next !== at) {
        c.target = next;
        wake.current();
        live.current.onTurn?.(next);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive]);

  /** A page joins (or leaves) the book: it takes its pose at once, from where the camera is now. */
  const register = useCallback((i: number, el: HTMLElement | null) => {
    if (!el) {
      pages.current.delete(i);
      return;
    }
    pages.current.set(i, el);
    poseOn(el, pagePose(offsetOf(i, cam.current.x), live.current.front, openNow.current));
    wake.current();
  }, []);

  const at = Math.max(0, Math.min(count - 1, index));
  const onKeyDown = (e: KeyboardEvent) => {
    const step = (d: 1 | -1) => {
      e.preventDefault();
      if (onStep) onStep(d);
      else onTurn?.(Math.max(0, Math.min(count - 1, at + d)));
    };
    if (e.key === 'ArrowRight' || e.key === 'PageDown') step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') step(-1);
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      onTurn?.(e.key === 'Home' ? 0 : Math.max(0, count - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.();
    } else onKey?.(e);
  };

  const shown = inView(near, count);
  const style = { ['--persp' as string]: `${perspectiveFor(front)}px`, ['--front' as string]: `${front}px` } as CSSProperties;
  return (
    <div
      ref={stage}
      className="journal-stage"
      style={style}
      onPointerDown={interactive ? onPointerDown : undefined}
      {...(interactive
        ? {
            role: 'listbox',
            id,
            tabIndex: 0,
            'aria-label': label,
            'aria-orientation': 'horizontal' as const,
            'aria-activedescendant': count ? `${id}-${at}` : undefined,
            onKeyDown,
          }
        : { 'aria-hidden': true })}
    >
      <div key={scene} className="journal-book">
        {front > 0 && shown.map(({ i }) => <PageView key={stops[i]!.exhibit.project_id} stop={stops[i]!} i={i} count={count} isFront={i === at} listId={interactive ? id : undefined} register={register} />)}
      </div>
    </div>
  );
}

/** Writes a page's pose: its place and turn, whether it is drawn, and the shade on it (its last
 *  child's opacity alone, so the page itself is never restyled). */
function poseOn(el: HTMLElement, p: PagePose) {
  el.style.transform = `translate3d(${p.x}px, 0, ${p.z}px) rotateY(${p.rotate}deg)`;
  el.style.visibility = p.hidden ? 'hidden' : '';
  (el.lastElementChild as HTMLElement | null)?.style.setProperty('opacity', String(Math.round(p.dim * 80) / 100));
}

interface PageProps {
  stop: ShowcaseStop;
  i: number;
  count: number;
  isFront: boolean;
  /** The listbox's id when the book is interactive (each page is then an option). */
  listId?: string;
  register: (i: number, el: HTMLElement | null) => void;
}

/** One page of the journal. Memoised: turning re-renders only the pages whose front-ness changes; the
 *  book's loop moves them all. */
const PageView = memo(function PageView({ stop: s, i, count, isFront, listId, register }: PageProps) {
  const e = s.exhibit;
  const by = e.portrait ? null : plaqueBy(e);
  const place = s.awards[0]?.award.place;
  return (
    <div
      ref={(el) => register(i, el)}
      className="journal-page"
      data-i={i}
      data-front={isFront || undefined}
      {...(listId ? { id: `${listId}-${i}`, role: 'option', 'aria-selected': isFront, 'aria-label': stopLabel(s, i, count) } : {})}
    >
      <span className="journal-paper" aria-hidden="true">
        <span className="journal-photo">
          {e.portrait ? (
            <span className="journal-portrait">
              <PixelAvatar username={e.username} name={e.full_name} avatarPath={e.avatar_path} />
            </span>
          ) : (
            <QuestArt project={e.project} className="journal-picture" />
          )}
          <i className="journal-tape" data-at="left" />
          <i className="journal-tape" data-at="right" />
        </span>
        <span className="journal-caption">
          <b className="journal-title">{e.portrait ? e.full_name : e.project.title}</b>
          {e.portrait ? <span className="journal-by">Featured member</span> : by && <span className="journal-by">by {by}</span>}
        </span>
        <span className="journal-folio">p.{String(i + 1).padStart(2, '0')}</span>
        {s.awards.length > 0 && (
          <span className="journal-ribbon" data-place={place ?? 'award'}>
            {place === 1 ? '1ST' : place === 2 ? '2ND' : place === 3 ? '3RD' : '♛'}
          </span>
        )}
      </span>
      <i className="journal-shade" aria-hidden="true" />
    </div>
  );
});
