// The power-on screen (D-077): painted before any script, gone once the app is ready.
import { expect, test } from '@playwright/test';

test('opening the app shows the power-on screen first, then the hall', async ({ page }) => {
  await page.goto('/');
  const splash = page.locator('#splash');
  await expect(splash).toBeVisible();
  await expect(splash).toContainText('PIXENDO');
  await expect(splash).toContainText('Powering on');
  await expect(splash).toHaveCount(0, { timeout: 6000 }); // removed, not just hidden
  await expect(page.getByRole('region', { name: /PIP-Hall players/ })).toBeVisible();
});

test('a reload in the same session only covers the real loading time', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 6000 });
  const start = Date.now();
  await page.reload();
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 6000 });
  expect(Date.now() - start).toBeLessThan(1400 + 1500); // no first-visit hold the second time
});

test('it never covers an error: a deep link still lands once the splash is gone', async ({ page }) => {
  await page.goto('/member/nobody-here');
  await expect(page.locator('#splash')).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('#missing-title, #profile-name')).toBeVisible();
});
