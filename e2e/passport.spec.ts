// V2-2: the Passport for guests (on this device), "Why Pip picked", and search results that walk
// Pip to a badge. Fixture data: Sample Quest One is a team project of players 1 and 2.
import { expect, test, type Page } from '@playwright/test';

const passport = (p: Page) => p.locator('.passport-screen');
const playerCount = (p: Page) => p.locator('.hud span').last();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('a guest Passport starts empty, fills as you meet people, and keeps on this device', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await page.getByRole('region', { name: 'START', exact: true }).getByRole('button', { name: /Passport/ }).click();
  await expect(page).toHaveURL(/\/passport$/);
  await expect(page).toHaveTitle('Passport · PIP-Hall');
  await expect(passport(page).getByRole('heading', { name: 'PASSPORT' })).toBeVisible();
  await expect(passport(page)).toContainText('Saved on this device.');
  await expect(passport(page).locator('.dialogue')).toContainText('Your Passport is empty');
  await passport(page).getByRole('button', { name: /◀ BACK/ }).click();
  await expect(page).toHaveURL(/\/$/);

  // Meet players 1 and 2: their team project is found.
  for (const u of ['sample-player-1', 'sample-player-2']) {
    await page.goto(`/member/${u}`);
    await expect(page.locator('.profile-screen')).toBeVisible();
  }
  await page.goto('/passport');
  const people = passport(page).getByRole('list', { name: 'People you found' });
  await expect(people.locator('li')).toHaveCount(2);
  await expect(passport(page).getByRole('meter', { name: 'People found' })).toHaveAttribute('aria-valuenow', '2');
  await expect(passport(page).getByRole('meter', { name: 'People found' })).toHaveAttribute('aria-valuemax', '6');
  await expect(passport(page).getByRole('list', { name: 'Team projects you’ve found' })).toContainText('Sample Quest One');
  await expect(passport(page).getByRole('list', { name: 'Skills you’ve seen' })).toContainText('TypeScript');
  await expect(passport(page)).toContainText('4 more to find.');

  // Survives a reload; a stamp leads back to the person.
  await page.reload();
  await expect(people.locator('li')).toHaveCount(2);
  await people.getByRole('link', { name: /Sample Player 2/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-2$/);
  await expect(page.locator('.profile-screen')).toBeVisible();
});

test('visiting an exhibit stamps it', async ({ page }) => {
  await page.goto('/museum/sample-player-2-0');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/ · Museum$/); // loaded (and stamped), not "Museum" while loading
  await page.goto('/passport');
  const visited = passport(page).getByRole('list', { name: 'Exhibits you’ve visited' });
  await expect(visited.locator('li')).toHaveCount(1);
  await expect(passport(page).getByRole('button', { name: /Passport · / })).toHaveCount(0); // the button lives in START
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await expect(page.getByRole('region', { name: 'START', exact: true }).getByRole('button', { name: /^Passport · 1/ })).toBeVisible();
});

test('Why Pip picked explains the match, and a listed result walks Pip there', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search players' }).fill('postgres');
  const why = page.getByRole('list', { name: /Why .* matches/ });
  await expect(why).toContainText('Lists Postgres in their skills');

  await page.getByRole('searchbox', { name: 'Search players' }).fill('sample quest');
  await page.getByRole('button', { name: 'List results' }).click();
  const results = page.getByRole('list', { name: 'Matching players' }).getByRole('button');
  await expect(results.nth(1)).toBeVisible(); // the new search's results, not the last one's
  const n = await results.count();
  expect(n).toBeGreaterThan(1);
  await results.nth(1).click();
  await expect(playerCount(page)).toHaveText(`2/${n}`);
  await expect(page.locator('.screen .dialogue').first()).toContainText('Pip found');
  await expect(results.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.screen')).toBeFocused();
});

test('a QR scan stamps the Passport and says so', async ({ page }) => {
  await page.goto('/member/sample-player-3?via=qr');
  await expect(page.locator('.profile-screen .dialogue').first()).toContainText('stamped in your Passport');
  await page.goto('/passport');
  await expect(passport(page).getByRole('list', { name: 'People you found' }).locator('li')).toHaveCount(1);
});
