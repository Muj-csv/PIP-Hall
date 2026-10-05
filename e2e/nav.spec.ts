// The top bar marks where you are, by state and shape, not colour alone (D-079).
import { expect, test } from '@playwright/test';

test('the top bar marks the current place', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Account' });
  await expect(nav.getByRole('link', { name: 'Hall', exact: true })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Museum', exact: true }).click();
  await expect(page).toHaveURL(/\/museum$/);
  await expect(nav.getByRole('link', { name: 'Museum', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Hall', exact: true })).not.toHaveAttribute('aria-current');
});

test('on phones the bar keeps to two rows', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.goto('/');
  const bar = (await page.locator('header.topbar').boundingBox())!;
  expect(bar.height).toBeLessThan(140);
});
