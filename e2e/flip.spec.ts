// The badge must never look empty while it turns (D-056, D-131): one face is showing at every frame.
// Samples the real CSS transition each animation frame in both directions, on a slowed-down CPU as
// well, where frames come late and the browser is busiest.
import { expect, test } from '@playwright/test';

for (const cpu of [1, 6]) {
  test(`a flip shows a face on every frame, both ways${cpu > 1 ? `, on a CPU ${cpu}× slower` : ''}`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'same CSS on both; desktop samples it');
    await page.goto('/member/sample-player-1');
    await page.locator('.profile-screen .badge-face[data-side="front"] .badge-hit').waitFor();
    if (cpu > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    }
    const blank = await page.evaluate(async () => {
      const badge = document.querySelector('.profile-screen .badge') as HTMLElement;
      const face = (s: string) => badge.querySelector(`.badge-face[data-side="${s}"]`) as HTMLElement;
      const shows = (s: string) => {
        const style = getComputedStyle(face(s));
        return style.visibility === 'visible' && Number(style.opacity) > 0;
      };
      const empty: string[] = [];
      for (const from of ['front', 'back']) {
        (face(from).querySelector('.badge-hit') as HTMLElement).click();
        const t0 = performance.now();
        while (performance.now() - t0 < 700) {
          await new Promise((r) => requestAnimationFrame(r));
          const m = new DOMMatrix(getComputedStyle(badge).transform);
          const deg = Math.abs((Math.atan2(-m.m13, m.m11) * 180) / Math.PI);
          const front = deg < 90 && shows('front');
          const back = deg > 90 && shows('back');
          if (Math.round(deg) !== 90 && !front && !back) empty.push(`${from}→ ${Math.round(performance.now() - t0)}ms ${Math.round(deg)}°`);
        }
      }
      return empty;
    });
    expect(blank).toEqual([]);
  });
}
