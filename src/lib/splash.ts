// The power-on screen in index.html (D-077). It is painted before any script runs, so opening the
// app never shows a blank page. The first visit in a session holds it briefly, long enough to read
// as a console powering on; reloads only cover the real loading time.

const SEEN_KEY = 'piphall-splash';
const BOOTED_KEY = 'piphall-booted'; // the hall's own power-on already played this session
const FIRST_VISIT_MS = 1400;
const FONT_WAIT_MS = 2500;
const EXIT_MS = 450;

/** How long the splash should stay up in total, from page start. */
export function splashHoldMs(firstVisit: boolean, reducedMotion: boolean): number {
  if (!firstVisit) return 0;
  return reducedMotion ? 600 : FIRST_VISIT_MS;
}

function firstVisitThisSession(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY) || sessionStorage.getItem(BOOTED_KEY)) return false;
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: treat every visit as a reload (shortest splash)
    return false;
  }
  return true;
}

/** Call once the app has rendered. Waits for the pixel fonts (capped) and the minimum hold. */
export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const hold = Math.max(0, splashHoldMs(firstVisitThisSession(), reduce) - performance.now());
  const fonts = document.fonts?.ready ?? Promise.resolve();
  const capped = Promise.race([fonts, new Promise((done) => setTimeout(done, FONT_WAIT_MS))]);
  void Promise.all([capped, new Promise((done) => setTimeout(done, hold))]).then(() => {
    el.dataset.state = 'done';
    el.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => el.remove(), reduce ? 0 : EXIT_MS);
  });
}
