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
  await page.goto('/privacy');
  await page.getByRole('link', { name: 'Museum' }).click();
  await expect(page).toHaveURL(/\/museum$/);
});

test('an exhibit has its own page: plaque, maker, neighbours, and a pixel cover when it has no image', async ({ page }) => {
  await page.goto('/museum');
  const first = page.getByRole('list', { name: 'Exhibits' }).locator(':scope > li').first();
  // No sample project has a cover image: every frame shows a drawn pixel cover, never an empty box.
  await expect(first.locator('canvas.exhibit-art')).toBeVisible();
  const title = (await first.getByRole('heading').textContent())!.trim();
  await first.getByRole('link', { name: title }).click();

  await expect(page).toHaveURL(/\/museum\/sample-player-\d-\d$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} · Museum`);
  await expect(page).toHaveTitle(`${title} · Museum · PIP-Hall`);
  await expect(page.locator('canvas.exhibit-art')).toBeVisible();
  await expect(page.getByText(/Made by Sample Player/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();

  // Walk to the next exhibit and back.
  const nav = page.getByRole('navigation', { name: 'More exhibits' });
  const url = page.url();
  await nav.getByRole('link').last().click();
  await expect(page).not.toHaveURL(url);
  await nav.getByRole('link').first().click();
  await expect(page).toHaveURL(url);

  await page.getByRole('main').getByRole('link', { name: 'Museum', exact: true }).click();
  await expect(page).toHaveURL(/\/museum$/);
});

test('an exhibit that is no longer on show says so and leads back to the Museum', async ({ page }) => {
  await page.goto('/museum/not-a-real-exhibit');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not on show');
  await expect(page.locator('.dialogue .sr-only')).toContainText('isn’t on show anymore');
  await page.locator('.dialogue').getByRole('link', { name: 'MUSEUM', exact: true }).click();
  await expect(page).toHaveURL(/\/museum$/);
});
