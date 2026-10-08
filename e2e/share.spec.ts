// Share the hall (D-088): a full-screen QR of the site, for people to scan their way in at events.
import { expect, test } from '@playwright/test';

test('Share the hall (in START) shows the site QR, and closes back to the hall', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await page.getByRole('region', { name: 'START', exact: true }).getByRole('button', { name: /Share the hall/ }).click();
  const sheet = page.getByRole('dialog', { name: 'JOIN THE HALL' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'QR code for the PIP-Hall website' })).toBeVisible();
  // The address under the code is the hall itself.
  await expect(sheet.locator('.font-mono')).toHaveText(/^https?:\/\/[^/]+\/$/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.screen').first()).toBeFocused();
});
