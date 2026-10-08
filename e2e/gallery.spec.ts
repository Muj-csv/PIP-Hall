// The Museum on sample data (fixture source): every sample project is an exhibit, shuffled.
import { expect, test } from '@playwright/test';

test('the Museum shows exhibits, shuffles them, and links to their makers', async ({ page }) => {
  await page.goto('/museum?view=list');
  await expect(page).toHaveTitle('Museum · PIP-Hall');
  const items = page.getByRole('list', { name: 'More exhibits' }).locator(':scope > li');
  await expect(items).toHaveCount(12); // the 13th is pinned in Featured
  await expect(page.getByRole('status').filter({ hasText: 'exhibits' })).toHaveText('13 exhibits');
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
  await page.goto('/museum?view=list');
  const first = page.getByRole('list', { name: 'More exhibits' }).locator(':scope > li').first();
  // No sample project has a cover image: every frame shows a drawn pixel cover, never an empty box.
  await expect(first.locator('.exhibit-diorama canvas')).toHaveCount(4);
  const title = (await first.getByRole('heading').textContent())!.trim();
  await first.getByRole('link', { name: title }).click();

  await expect(page).toHaveURL(/\/museum\/sample-player-\d-\d$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} · Museum`);
  await expect(page).toHaveTitle(`${title} · Museum · PIP-Hall`);
  await expect(page.locator('.exhibit-diorama')).toBeVisible();
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

test('featured makers are pinned on top, and Shuffle never moves them', async ({ page }) => {
  await page.goto('/museum?view=list');
  const featured = page.getByRole('region', { name: 'Featured' });
  await expect(featured.getByRole('list', { name: 'Featured exhibits' }).locator(':scope > li')).toHaveCount(1);
  await expect(featured).toContainText('Sample Player 2');
  await expect(featured.locator('.exhibit-frame[data-featured]')).toHaveCount(1);
  const before = await featured.textContent();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: /Shuffle/ }).click();
    await expect(featured).toHaveText(before!);
  }
  await expect(page.getByRole('list', { name: 'More exhibits' })).not.toContainText('by Sample Player 2'); // credited as a collaborator is fine
});

test('exhibits tilt toward the pointer, and lie flat with reduced motion', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer');
  await page.addInitScript(() => sessionStorage.setItem('piphall-splash', '1'));
  await page.goto('/museum?view=list');
  const view = page.locator('.exhibit-view').first();
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.1);
  await expect(view).toHaveAttribute('style', /--tx: 0\.9/);
  await expect.poll(() => view.locator('.exhibit-frame').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => view.locator('.exhibit-frame').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});
