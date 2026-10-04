// The Museum on sample data (fixture source): every sample project is an exhibit, shuffled.
import { expect, test } from '@playwright/test';

test('the Museum shows exhibits, shuffles them, and links to their makers', async ({ page }) => {
  await page.goto('/museum');
  await expect(page).toHaveTitle('Museum · PIP-Hall');
  const items = page.getByRole('list', { name: 'Exhibits' }).locator(':scope > li');
  await expect(items).toHaveCount(13);
  await expect(page.getByRole('status')).toHaveText('13 exhibits');
  const before = await items.allTextContents();
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    await page.getByRole('button', { name: /Shuffle/ }).click();
    changed = (await items.allTextContents()).join() !== before.join();
  }
  expect(changed).toBe(true);
  await items.first().getByRole('link').filter({ hasText: /Sample Player/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-\d$/);
});

test('the top bar leads to the Museum', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('link', { name: 'Museum' }).click();
  await expect(page).toHaveURL(/\/museum$/);
});
