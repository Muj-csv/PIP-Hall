// FR-14: the install button appears when the browser offers installation, and iPhones get the
// Add to Home Screen steps. (Manifest and service worker are checked on the production build.)
import { expect, test } from '@playwright/test';

test('Chrome/Android: the browser’s own install dialog opens from our button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Install PIP-Hall/ })).toHaveCount(0);
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
    e.prompt = () => {
      (window as unknown as Record<string, boolean>).__prompted = true;
      return Promise.resolve();
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.getByRole('button', { name: /Install PIP-Hall/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Record<string, boolean>).__prompted)).toBe(true);
  await expect(page.getByRole('button', { name: /Install PIP-Hall/ })).toHaveCount(0);
});

test.describe('iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  test('shows the Share → Add to Home Screen steps', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Install PIP-Hall/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Install on iPhone or iPad' });
    await expect(sheet).toContainText('Add to Home Screen');
    await sheet.getByRole('button', { name: 'Got it' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: /Install PIP-Hall/ })).toBeFocused();
  });
});
