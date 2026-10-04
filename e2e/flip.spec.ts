// The badge must never look empty while it turns (D-056): one face is showing at every frame.
// Samples the real CSS transition each animation frame in both directions.
import { expect, test } from '@playwright/test';

test('a flip shows a face on every frame, both ways', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same CSS on both; desktop samples it');
  await page.goto('/member/sample-player-1');
  await page.locator('.profile-screen .badge-face[data-side="front"] .badge-hit').waitFor();
  const blank = await page.evaluate(async () => {
    const badge = document.querySelector('.profile-screen .badge') as HTMLElement;
    const face = (s: string) => badge.querySelector(`.badge-face[data-side="${s}"]`) as HTMLElement;
    const empty: string[] = [];
    for (const from of ['front', 'back']) {
      (face(from).querySelector('.badge-hit') as HTMLElement).click();
      const t0 = performance.now();
      while (performance.now() - t0 < 700) {
        await new Promise((r) => requestAnimationFrame(r));
        const m = new DOMMatrix(getComputedStyle(badge).transform);
        const deg = Math.abs((Math.atan2(-m.m13, m.m11) * 180) / Math.PI);
        const front = deg < 90 && getComputedStyle(face('front')).visibility === 'visible';
        const back = deg > 90 && getComputedStyle(face('back')).visibility === 'visible';
        if (Math.round(deg) !== 90 && !front && !back) empty.push(`${from}→ ${Math.round(performance.now() - t0)}ms ${Math.round(deg)}°`);
      }
    }
    return empty;
  });
  expect(blank).toEqual([]);
});
