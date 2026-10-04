// Phase 1 acceptance (docs/build/PHASE-1.md): browse, flip, QR full screen, drag vs tap,
// keyboard only, reduced motion. Runs on the fixture data.
import { expect, test, type Page } from '@playwright/test';

const current = (p: Page) => p.locator('.slot:not([aria-hidden]) .badge');
const playerCount = (p: Page) => p.locator('.hud span').last();
const coins = (p: Page) => p.locator('.hud-coins');

test.beforeEach(async ({ page }) => {
  // Skip the once-per-session boot animation so tests start in a settled level.
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(page.locator('.slot').first()).toBeVisible();
});

test('shows the first player with only the current card ±2 rendered', async ({ page }) => {
  await expect(playerCount(page)).toHaveText('1/6');
  await expect(current(page)).toHaveAttribute('data-flipped', 'false');
  expect(await page.locator('.slot').count()).toBeLessThanOrEqual(5);
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and keyboard');

  test('keyboard only: browse, flip, QR full screen, profile', async ({ page }) => {
    const screen = page.getByRole('region', { name: /PIP-Hall players/ });
    await screen.focus();
    await page.keyboard.press('ArrowRight');
    await expect(playerCount(page)).toHaveText('2/6');
    await page.keyboard.press('ArrowLeft');
    await expect(playerCount(page)).toHaveText('1/6');

    await page.keyboard.press('Enter'); // Pip jumps; the flip lands on contact
    await expect(current(page)).toHaveAttribute('data-flipped', 'true');
    await expect(coins(page)).toContainText('01');
    await page.keyboard.press('Space');
    await expect(current(page)).toHaveAttribute('data-flipped', 'false');

    const qr = page.locator('.slot:not([aria-hidden]) .qr-button');
    for (let i = 0; i < 8 && !(await qr.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(qr).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'SCAN ME' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(qr).toBeFocused();

    await screen.focus();
    await page.keyboard.press('o');
    await expect(page.getByRole('heading', { level: 2, name: 'Sample Player 1' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /◀ BACK/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-screen')).toHaveCount(0);
  });

  test('a drag browses and never flips; a click always flips', async ({ page }) => {
    const box = (await current(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(x - i * 15, y);
    await page.mouse.up();
    await expect(playerCount(page)).toHaveText('2/6');
    await expect(page.locator('.badge[data-flipped="true"]')).toHaveCount(0);

    const b2 = (await current(page).boundingBox())!;
    await page.mouse.click(b2.x + b2.width / 2, b2.y + 40);
    await expect(current(page)).toHaveAttribute('data-flipped', 'true');
  });

  test('clicking a neighbour walks to it instead of flipping it', async ({ page }) => {
    const neighbour = page.locator('.slot[aria-label^="Player 2 of"]');
    const nb = (await neighbour.boundingBox())!;
    await page.mouse.click(nb.x + 30, nb.y + 140);
    await expect(playerCount(page)).toHaveText('2/6');
    await expect(page.locator('.badge[data-flipped="true"]')).toHaveCount(0);
  });

  test('the MOVE rocker stops at both ends', async ({ page }) => {
    const next = page.getByRole('button', { name: 'Next player' });
    for (let i = 0; i < 8; i++) await next.click();
    await expect(playerCount(page)).toHaveText('6/6');
    await page.getByRole('button', { name: 'Previous player' }).click();
    await expect(playerCount(page)).toHaveText('5/6');
  });

  test('DAY / NIGHT switch sets the theme', async ({ page }) => {
    await page.getByRole('radio', { name: 'NIGHT' }).check({ force: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: /Switch to day/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch');

  test('a swipe browses and never flips; a tap flips', async ({ page, context }) => {
    await page.locator('.screen').scrollIntoViewIfNeeded();
    const cdp = await context.newCDPSession(page);
    const box = (await current(page).boundingBox())!;
    const y = box.y + 120;
    const x0 = box.x + box.width / 2 + 60;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - i * 14, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(playerCount(page)).toHaveText('2/6');
    await expect(page.locator('.badge[data-flipped="true"]')).toHaveCount(0);

    const b2 = (await current(page).boundingBox())!;
    await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + 40);
    await expect(current(page)).toHaveAttribute('data-flipped', 'true');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('flip is instant and the coin still counts', async ({ page }) => {
    await page.getByRole('region', { name: /PIP-Hall players/ }).focus();
    await page.keyboard.press('Enter');
    await expect(current(page)).toHaveAttribute('data-flipped', 'true', { timeout: 100 });
    await expect(coins(page)).toContainText('01');
  });
});
