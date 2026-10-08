// Search, filters and Random player in the hall (FR-13, D-072): they narrow the badges hanging in the
// level, so flipping and OPEN still work on the results. Fixture data (src/data/sample-cards.json).
import { expect, test, type Page } from '@playwright/test';

const playerCount = (p: Page) => p.locator('.hud span').last();
const current = (p: Page) => p.locator('.slot:not([aria-hidden]) .badge');
/** Opens the device's START menu (D-126) and returns it. */
const start = async (page: Page) => {
  await page.getByRole('button', { name: 'START', exact: true }).click();
  return page.getByRole('region', { name: 'START', exact: true });
};
const status = (p: Page) => p.getByRole('region', { name: 'Find players' }).getByRole('status');
const q = (p: Page) => p.getByRole('searchbox', { name: 'Search players' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
});

test('search narrows the hall by name, handle, skill and project title, and lives in the address', async ({ page }) => {
  await page.goto('/');
  await expect(status(page)).toHaveText('6 players in the hall');
  await expect(playerCount(page)).toHaveText('1/6');

  await q(page).fill('very long name');
  await expect(status(page)).toHaveText('1 of 6 players match');
  await expect(playerCount(page)).toHaveText('1/1');
  await expect(current(page)).toContainText('Sample Player Three');

  await q(page).fill('@sample-player-5');
  await expect(playerCount(page)).toHaveText('1/1');
  await expect(current(page)).toContainText('Sample Player 5');

  await q(page).fill('postgres');
  await expect(current(page)).toContainText('Sample Player 1');

  await q(page).fill('quest solo');
  await expect(current(page)).toContainText('Sample Player 5');
  await expect(page).toHaveURL(/\/\?q=quest\+solo$/);
});

test('the badges keep their effects: a search result flips and opens its profile, and BACK keeps the search', async ({ page }) => {
  await page.goto('/?q=postgres');
  await expect(playerCount(page)).toHaveText('1/1');
  await page.getByRole('button', { name: 'FLIP', exact: true }).first().click();
  await expect(current(page)).toHaveAttribute('data-flipped', 'true');
  await page.getByRole('button', { name: 'OPEN', exact: true }).first().click();
  await expect(page).toHaveURL(/\/member\/sample-player-1\?q=postgres$/);
  await expect(page.locator('#profile-name')).toHaveText('Sample Player 1');
  await page.getByRole('button', { name: /◀ BACK/ }).first().click();
  await expect(page).toHaveURL(/\/\?q=postgres$/);
  await expect(playerCount(page)).toHaveText('1/1');
});

test('filters by skill and featured, and Pip says when nothing matches', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Filters/ }).click();
  const sample = page.getByRole('group', { name: 'Skill' }).getByRole('button', { name: /^Sample \d+ players$/ });
  await sample.click();
  await expect(sample).toHaveAttribute('aria-pressed', 'true');
  await expect(sample).toContainText('✓');
  await expect(playerCount(page)).toHaveText('1/2');
  await expect(page.getByRole('button', { name: /Filters \(1\)/ })).toBeVisible();

  await page.getByRole('button', { name: /Featured only/ }).click();
  await expect(playerCount(page)).toHaveText('1/1');
  await expect(current(page)).toContainText('FEATURED');

  await q(page).fill('nobody-at-all');
  await expect(page.locator('.dialogue .sr-only')).toContainText('Nobody matches that');
  await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
  await expect(playerCount(page)).toHaveText('1/6');
  await expect(status(page)).toHaveText('6 players in the hall');
});

test('Random player walks to one of the results', async ({ page }) => {
  await page.goto('/?q=quest+solo');
  await (await start(page)).getByRole('button', { name: /Random player/ }).click();
  await expect(page.locator('.dialogue .sr-only')).toContainText('Random player: Sample Player 5');
  await expect(current(page)).toContainText('Sample Player 5');

  await page.goto('/');
  await (await start(page)).getByRole('button', { name: /Random player/ }).click();
  await expect(page.locator('.dialogue .sr-only')).toContainText('Random player:');
  await expect(playerCount(page)).not.toHaveText('1/6'); // never the player already in front
});

test('old /explore links land in the hall with the same search', async ({ page }) => {
  await page.goto('/explore?q=postgres');
  await expect(page).toHaveURL(/\/\?q=postgres$/);
  await expect(q(page)).toHaveValue('postgres');
  await expect(playerCount(page)).toHaveText('1/1');
});

test('the top bar Hall button leads back to the hall', async ({ page }) => {
  await page.goto('/privacy');
  const hall = page.getByRole('navigation').getByRole('link', { name: 'Hall', exact: true });
  await hall.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(hall).toHaveAttribute('aria-current', 'page');
});

test('a screen whose code fails to load shows the error dialogue, not a blank page', async ({ page }) => {
  await page.route('**/src/pages/Museum.tsx*', (r) => r.abort());
  await page.goto('/museum');
  await expect(page.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only')).toContainText('didn’t load');
  await expect(page.getByRole('button', { name: 'RELOAD' })).toBeVisible();
});
