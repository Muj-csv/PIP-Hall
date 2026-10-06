// V2-1 (D-095): a badge's QR is marked as a scan and greets the finder; fixture data, so no
// server functions, and so no Save badge button.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('a badge QR opens the profile with a greeting, then tidies the address', async ({ page }) => {
  await page.goto('/member/sample-player-4?via=qr');
  await expect(page.locator('.profile-screen .dialogue')).toContainText('You found Sample! You scanned their badge.');
  await expect(page).toHaveURL(/\/member\/sample-player-4$/);
  // Reloading isn't a new scan.
  await page.reload();
  await expect(page.locator('.profile-screen')).toBeVisible();
  await expect(page.locator('.profile-screen .dialogue')).toHaveCount(0);
});

test('the QR sheet shows the plain address; the code carries the scan mark', async ({ page }) => {
  await page.goto('/member/sample-player-4');
  await page.locator('.profile-screen').getByRole('button', { name: 'SCAN ME · show QR' }).click();
  const sheet = page.getByRole('dialog', { name: 'SCAN ME' });
  await expect(sheet.locator('p.font-mono')).toHaveText('https://pip-hall.example/member/sample-player-4');
});

test('no Save badge button without the server', async ({ page }) => {
  await page.goto('/member/sample-player-4');
  await expect(page.locator('.profile-screen')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Save badge (PNG)' })).toHaveCount(0);
});
