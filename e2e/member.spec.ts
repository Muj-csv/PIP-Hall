// Phase 4 acceptance (docs/build/PHASE-4.md): the page a badge's QR code opens. Fixture data.
import { expect, test } from '@playwright/test';

test('a member page loads cold, with the full card, all projects, links and the QR sheet', async ({ page, isMobile }) => {
  await page.goto('/member/sample-player-4');
  await expect(page.getByRole('heading', { level: 1, name: 'Sample Player 4' })).toBeVisible();
  await expect(page).toHaveTitle('Sample Player 4 · PIP-Hall');
  await expect(page.getByText('@sample-player-4 · No.004')).toBeVisible();

  // Every project, not just the three that fit on the badge.
  await expect(page.locator('.quest-list > li')).toHaveCount(6);

  if (isMobile) {
    // Phone: one badge that flips.
    await expect(page.locator('.member-badges .badge')).toHaveCount(1);
    await page.getByRole('button', { name: 'Show Quest Log' }).click();
    await expect(page.locator('.member-badges .badge')).toHaveAttribute('data-flipped', 'true');
  } else {
    // Desktop: both faces side by side, nothing to flip.
    await expect(page.locator('.member-badges .badge')).toHaveCount(2);
    await expect(page.locator('.member-badges figcaption')).toHaveText(['FRONT', 'QUEST LOG']);
    await expect(page.locator('.member-badges .badge-hit')).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'SCAN ME · show QR' }).click();
  const sheet = page.getByRole('dialog', { name: 'SCAN ME' });
  await expect(sheet).toContainText('https://pip-hall.example/member/sample-player-4');
  await expect(sheet).toContainText('brightness');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await page.getByRole('link', { name: '◀ Back to the collection' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('an unknown username gets the not-found dialogue', async ({ page }) => {
  await page.goto('/member/nobody-here');
  await expect(page.getByRole('heading', { level: 1, name: 'No card here' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only')).toContainText('Nobody in the hall goes by @nobody-here');
  await expect(page.getByRole('link', { name: '◀ Back to the collection' })).toBeVisible();
});

test('a member with no projects says so', async ({ page }) => {
  await page.goto('/member/sample-player-3');
  await expect(page.locator('.dialogue .sr-only')).toContainText('hasn’t added any quests yet');
});

test('the in-hall profile screen links to the full page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same route on both; desktop covers the hall path');
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'OPEN', exact: true }).click();
  await page.getByRole('link', { name: /FULL PAGE/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sample Player 1' })).toBeVisible();
});
