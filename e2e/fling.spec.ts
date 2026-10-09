// Grab and fling (D-082): hold the current badge to swing it; it never browses or flips, and a quick
// drag still browses. Reduced motion turns it off.
import { expect, test, type Page } from '@playwright/test';

const slot = (p: Page) => p.locator('.slot:not([aria-hidden])');
const current = (p: Page) => slot(p).locator('.badge');
const playerCount = (p: Page) => p.locator('.hud span').last();
/** The current slot's swing angle, read from its transform. */
const angle = (p: Page) => slot(p).evaluate((el) => Number(/rotate\(([-\d.]+)deg\)/.exec((el as HTMLElement).style.transform)?.[1] ?? 0));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(current(page)).toBeVisible();
  await page.locator('.screen').scrollIntoViewIfNeeded();
});

test('hold a badge with the mouse, swing it, let go: it swings back and stays put', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse');
  const box = (await current(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 140;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(500); // past the hold
  await expect(page.locator('.dialogue')).toContainText('Wheee!');
  await page.mouse.move(x + 80, y, { steps: 8 });
  await expect.poll(() => angle(page)).toBeGreaterThan(5);
  await page.mouse.up();
  await expect(playerCount(page)).toHaveText('1/6'); // the camera never moved
  await expect(current(page)).toHaveAttribute('data-flipped', 'false'); // letting go is not a click
  await expect.poll(() => angle(page).then(Math.abs), { timeout: 8000 }).toBeLessThan(0.5); // back to rest
});

test('a quick drag still browses', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse');
  const box = (await current(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 140;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 160, y, { steps: 10 });
  await page.mouse.up();
  await expect(playerCount(page)).toHaveText('2/6');
});

test('on a phone, a long press grabs the badge and the swipe swings it instead of browsing', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'touch');
  const cdp = await context.newCDPSession(page);
  const box = (await current(page).boundingBox())!;
  const x0 = box.x + box.width / 2;
  const y = box.y + 140;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  await page.waitForTimeout(500);
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 10, y }] });
  await expect.poll(() => angle(page)).toBeLessThan(-5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(playerCount(page)).toHaveText('1/6');
  await expect(current(page)).toHaveAttribute('data-flipped', 'false');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('holding does nothing special', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse');
    const box = (await current(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 140);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + 140, { steps: 8 });
    expect(await angle(page)).toBe(0);
    await page.mouse.up();
    await expect(page.locator('.dialogue')).not.toContainText('Wheee!');
  });
});
