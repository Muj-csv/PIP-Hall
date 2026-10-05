// Batch 1 (D-080): earned rank gems, foil on Legends, the page dissolve.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
});

test('ranks are earned from projects and said in words on the profile', async ({ page }) => {
  await page.goto('/member/sample-player-4'); // 6 projects: a full Quest Log
  await expect(page.getByTestId('rank')).toContainText('LEGEND RANK');
  const badge = page.locator('.profile-screen .badge').first();
  await expect(badge).toHaveAttribute('data-rank', 'legend');
  await expect(badge).toHaveAttribute('data-foil', 'true');
  await expect(badge.locator('.band-rank').first()).toHaveAttribute('title', /Legend/);

  await page.goto('/member/sample-player-1'); // 3 projects
  await expect(page.getByTestId('rank')).toContainText('BUILDER RANK');
  await expect(page.locator('.profile-screen .badge').first()).not.toHaveAttribute('data-foil');

  await page.goto('/member/sample-player-3'); // no projects yet
  await expect(page.getByTestId('rank')).toContainText('MEMBER RANK');
});

test('pages open through a dissolve that never takes a click', async ({ page }) => {
  await page.goto('/museum');
  const dissolve = page.locator('.page-dissolve');
  await expect(dissolve).toHaveCSS('pointer-events', 'none');
  await expect(dissolve).toBeHidden(); // gone after 280 ms
});

test('reduced motion skips the dissolve', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/museum');
  await expect(page.locator('.page-dissolve')).toHaveCSS('display', 'none');
});
