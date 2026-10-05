// Privacy page (Google's consent screen links to it).
import { expect, test } from '@playwright/test';

test('the privacy page loads cold and leads back to the hall', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await expect(page).toHaveTitle('Privacy · PIP-Hall');
  await expect(page.getByRole('heading', { level: 2, name: 'What visitors can see' })).toBeVisible();
  await expect(page.getByText('Last updated')).toBeVisible();
  await page.getByRole('link', { name: '◀ Back to the hall' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('the hall links to the privacy page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});
