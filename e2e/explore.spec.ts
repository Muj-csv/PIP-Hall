// Phase 5 acceptance (docs/build/PHASE-5.md): search finds a member by name, handle, skill and
// project title; filters and Random player. Fixture data (src/data/sample-cards.json).
import { expect, test } from '@playwright/test';

const grid = (page: import('@playwright/test').Page) => page.locator('.explore-grid > li');

test('lists every player, then narrows by name, handle, skill and project title', async ({ page }) => {
  await page.goto('/explore');
  await expect(page).toHaveTitle('Explore · PIP-Hall');
  await expect(page.getByRole('status').filter({ hasText: 'players in the hall' })).toHaveText('6 players in the hall');
  await expect(grid(page)).toHaveCount(6);

  const q = page.getByRole('searchbox', { name: 'Search players' });
  await q.fill('very long name');
  await expect(grid(page)).toHaveCount(1);
  await expect(grid(page).first()).toContainText('Sample Player Three With A Very Long Name');

  await q.fill('@sample-player-5');
  await expect(grid(page)).toHaveCount(1);
  await expect(page.getByText('1 of 6 players match')).toBeVisible();

  await q.fill('postgres');
  await expect(grid(page)).toHaveCount(1);
  await expect(grid(page).first()).toContainText('@sample-player-1');

  await q.fill('quest solo');
  await expect(grid(page)).toHaveCount(1);
  await expect(grid(page).first()).toContainText('@sample-player-5');

  // The search is in the URL, so it can be shared.
  await expect(page).toHaveURL(/\/explore\?q=quest\+solo$/);
});

test('filters by skill and featured, and says when nothing matches', async ({ page }) => {
  await page.goto('/explore');
  const skills = page.getByRole('group', { name: 'Skill' });
  const sample = skills.getByRole('button', { name: /^Sample \d+ players$/ });
  await sample.click();
  await expect(sample).toHaveAttribute('aria-pressed', 'true');
  await expect(sample).toContainText('✓');
  await expect(grid(page)).toHaveCount(2);

  await page.getByRole('button', { name: /Featured only/ }).click();
  await expect(grid(page)).toHaveCount(1);
  await expect(grid(page).first()).toContainText('FEATURED');

  await page.getByRole('searchbox', { name: 'Search players' }).fill('nobody-at-all');
  await expect(page.locator('.dialogue .sr-only')).toContainText('Nobody matches that');
  await page.getByRole('button', { name: 'CLEAR', exact: true }).click();
  await expect(grid(page)).toHaveCount(6);
  await expect(page.getByRole('searchbox', { name: 'Search players' })).toBeFocused();
});

test('a card opens the member page; Random player opens one of the results', async ({ page }) => {
  await page.goto('/explore?q=postgres');
  await page.getByRole('link', { name: 'Sample Player 1' }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-1$/);

  await page.goto('/explore?q=quest+solo');
  await page.getByRole('button', { name: /Random player/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-5$/);
});

test('the top bar leads to Explore', async ({ page }) => {
  await page.goto('/privacy');
  await page.getByRole('link', { name: 'Explore' }).click();
  await expect(page).toHaveURL(/\/explore$/);
});

test('a screen whose code fails to load shows the error dialogue, not a blank page', async ({ page }) => {
  await page.route('**/src/pages/Explore.tsx*', (r) => r.abort());
  await page.goto('/explore');
  await expect(page.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only')).toContainText('didn’t load');
  await expect(page.getByRole('button', { name: 'RELOAD' })).toBeVisible();
});
