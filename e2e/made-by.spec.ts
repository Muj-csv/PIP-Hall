// Museum v3 phase 2 (D-090): an exhibit shows every maker's badge, the gallery plaque credits the
// collaborators, and a collaborator's profile lists the projects they helped make. Fixture data:
// Sample Quest One belongs to Sample Player 1 and credits Sample Player 2.
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('a collaboration exhibit shows the badges of everyone who made it', async ({ page }) => {
  await page.goto('/museum/sample-player-1-0');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample Quest One · Museum');
  await expect(page.getByText(/Made by Sample Player 1 with Sample Player 2/)).toBeVisible();

  const makers = page.getByRole('list', { name: 'Makers' }).locator(':scope > li');
  await expect(makers).toHaveCount(2);
  await expect(makers.locator('.badge')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: /Made by · 2 makers/ })).toBeVisible();

  // Each badge turns over and leads to its maker's profile.
  const second = makers.nth(1);
  await second.locator('.badge').click();
  await expect(second.locator('.badge')).toHaveAttribute('data-flipped', 'true');
  await second.getByRole('link', { name: /Open profile/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-2$/);
});

test('a solo exhibit shows one maker', async ({ page }) => {
  await page.goto('/museum/sample-player-1-1');
  await expect(page.getByRole('list', { name: 'Makers' }).locator(':scope > li')).toHaveCount(1);
});

test('the gallery plaque credits collaborators', async ({ page }) => {
  await page.goto('/museum?view=list');
  await expect(page.locator('.exhibit', { hasText: 'Sample Quest One' }).first()).toContainText('with Sample Player 2');
});

test('profiles show the credit both ways', async ({ page }) => {
  await page.goto('/member/sample-player-2');
  const profile = page.locator('.profile-screen');
  const collabs = profile.getByRole('region', { name: /Collaborations/ });
  await expect(collabs).toContainText('Sample Quest One');
  await expect(collabs).toContainText('with Sample Player 1 (@sample-player-1)');

  await page.goto('/member/sample-player-1');
  await expect(page.locator('.profile-screen .quest-list')).toContainText('With Sample Player 2');
  await expect(page.locator('.profile-screen').getByRole('region', { name: /Collaborations/ })).toHaveCount(0);
});
