// Share the hall (D-088): a full-screen QR of the site, for people to scan their way in at events.
import { expect, test } from '@playwright/test';

test('Share the hall shows the site QR, and closes back to the button', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  const share = page.getByRole('button', { name: 'Share the hall' });
  await share.click();
  const sheet = page.getByRole('dialog', { name: 'JOIN THE HALL' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'QR code for the PIP-Hall website' })).toBeVisible();
  // The address under the code is the hall itself.
  await expect(sheet.locator('.font-mono')).toHaveText(/^https?:\/\/[^/]+\/$/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(share).toBeFocused();
});
