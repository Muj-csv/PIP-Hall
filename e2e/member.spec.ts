// The member profile (FR-11) lives inside the PIXENDO screen: OPEN / VIEW PROFILE iris into it and
// the address becomes /member/:username; that address (what a badge's QR opens) loads straight
// onto it. Fixture data.
import { expect, test, type Page } from '@playwright/test';

const profile = (page: Page) => page.locator('.profile-screen');
const badge = (page: Page) => profile(page).locator('.badge');

test('a QR link loads cold onto the profile inside the device: tappable badge, all projects, QR sheet', async ({ page }) => {
  await page.goto('/member/sample-player-4');
  await expect(page.locator('#profile-name, #missing-title')).toHaveText('Sample Player 4');
  await expect(page).toHaveTitle('Sample Player 4 · PIP-Hall');
  await expect(profile(page).getByText('@sample-player-4 · No.004')).toBeVisible();
  await expect(page.getByRole('button', { name: /◀ BACK/ }).first()).toBeFocused();

  // Every project, not just the three that fit on the badge.
  await expect(profile(page).locator('.quest-list > li')).toHaveCount(6);

  // One live badge that turns over when tapped, like My card.
  await expect(badge(page)).toHaveCount(1);
  await profile(page).getByRole('button', { name: /^Card of Sample Player 4/ }).click();
  await expect(badge(page)).toHaveAttribute('data-flipped', 'true');
  await expect(profile(page).getByRole('button', { name: 'Show front' })).toBeVisible();
  await profile(page).getByRole('button', { name: /^Quest Log of Sample Player 4/ }).click();
  await expect(badge(page)).toHaveAttribute('data-flipped', 'false');

  await profile(page).getByRole('button', { name: 'SCAN ME · show QR' }).click();
  const sheet = page.getByRole('dialog', { name: 'SCAN ME' });
  await expect(sheet).toContainText('https://pip-hall.example/member/sample-player-4');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // BACK returns to the hall, on that member's badge.
  await profile(page).getByRole('button', { name: /◀ BACK/ }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(profile(page)).toHaveCount(0);
  await expect(page.locator('.hud span').last()).toHaveText('4/6');
  await expect(page).toHaveTitle('PIP-Hall · Where every person has a place');
});

test('VIEW PROFILE on a badge opens the profile inside the device, and browser Back closes it', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  const current = page.locator('.slot:not([aria-hidden]) .badge');
  await page.locator('.slot:not([aria-hidden]) .badge-face[data-side="front"] .badge-hit').click();
  await expect(current).toHaveAttribute('data-flipped', 'true');
  await page.locator('.slot:not([aria-hidden])').getByRole('button', { name: 'VIEW PROFILE ▸' }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-1$/);
  await expect(page.locator('#profile-name, #missing-title')).toHaveText('Sample Player 1');
  // Still the same page: the handheld is there and its button now says BACK.
  await expect(page.locator('.device')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'BACK', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  await expect(profile(page)).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('#profile-name, #missing-title')).toHaveText('Sample Player 1');
});

test('an unknown username shows the not-found dialogue inside the device', async ({ page }) => {
  await page.goto('/member/nobody-here');
  await expect(page.locator('#profile-name, #missing-title')).toHaveText('No card here');
  await expect(profile(page).locator('.dialogue .sr-only')).toContainText('Nobody in the hall goes by @nobody-here');
  await profile(page).getByRole('button', { name: /◀ BACK/ }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test('a member with no projects says so', async ({ page }) => {
  await page.goto('/member/sample-player-3');
  await expect(profile(page).locator('.dialogue .sr-only')).toContainText('hasn’t added any quests yet');
});

test('with PIPs switched off, opening profiles never calls the PIP functions', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same on both');
  const { mockSupabase } = await import('./mockSupabase');
  const log = await mockSupabase(page, { user: { id: '00000000-0000-4000-8000-0000000000a1', email: 'm@example.org', name: 'M', role: 'member' } });
  await page.goto('/member/sample-player-2');
  await expect(page.locator('#profile-name')).toHaveText('Sample Player 2');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'PIPs' })).toHaveCount(0);
  expect(log.requests.some((r) => /my_pips|discover_card|pip_ledger|achievements/.test(r))).toBe(false);
});
