// The two circles (D-129): the hall opens with the players on one arc and the chosen player's quests
// on the other, their badge and the chosen quest between. Choosing another player turns the quests
// over to theirs; VIEW opens a quest inside the device; START switches to the level and back.
// Runs on the fixture data, on desktop and phone.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const EVIDENCE = 'docs/build/evidence/circles';
mkdirSync(EVIDENCE, { recursive: true });

const players = (p: Page) => p.getByRole('listbox', { name: 'Players' });
const quests = (p: Page) => p.locator('#hall-quests');
const panel = (p: Page) => p.locator('.quest-panel');
const line = (p: Page) => p.locator('.screen .dialogue .sr-only').first();

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('players on one arc, the chosen player’s quests on the other; they follow the player', async ({ page }, info) => {
  await page.goto('/');
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName('Sample Player 1, player 1 of 6');
  await expect(quests(page)).toHaveAccessibleName('Sample’s quests');
  await expect(quests(page).getByRole('option')).toHaveCount(3);
  await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest One');
  await expect(page.locator('.circles .badge')).toHaveCount(1); // the chosen player's real badge, between the arcs
  await page.waitForTimeout(800); // the arcs come to rest
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/hall-${info.project.name}.png` });

  // Another player: their quests take over the other arc. (MOVE ▶, as players far round the arc are off the screen.)
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName('Sample Player 4, player 4 of 6');
  await expect(quests(page).getByRole('option')).not.toHaveCount(3);
  await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 1 of 6: Sample Quest 1');
  await expect(page.locator('.hud')).toContainText('4/6');

  // A quest: Pip goes over to it, and VIEW opens it inside the device.
  await quests(page).getByRole('option', { name: /Quest 2 of 6/ }).click();
  await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest 2');
  await expect(line(page)).toContainText('Quest 2 of 6: Sample Quest 2. VIEW opens it.');
  await page.waitForTimeout(700);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/hall-quest-${info.project.name}.png` });
  await panel(page).getByRole('button', { name: /VIEW/ }).click();
  await expect(page).toHaveURL(/\/member\/sample-player-4\/quest\/2$/);
  const screen = page.locator('.quest-screen');
  await expect(screen.getByRole('heading', { level: 2 })).toHaveText('Sample Quest 2');
  await expect(screen).toContainText('QUEST 2 OF 6');
  await expect(page).toHaveTitle('Sample Quest 2 · Sample Player 4 · PIP-Hall');
  await page.waitForTimeout(700);
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/quest-screen-${info.project.name}.png` });

  // Another of their quests from the screen, then BACK: the circles keep it chosen.
  await screen.getByRole('link', { name: /Sample Quest 5/ }).click();
  await expect(page).toHaveURL(/\/quest\/5$/);
  await expect(screen.getByRole('heading', { level: 2 })).toHaveText('Sample Quest 5');
  await screen.getByRole('button', { name: /BACK/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 5 of 6: Sample Quest 5');
});

test('a player with no quests says so', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next player' }).click();
  await players(page).getByRole('option', { name: /Sample Player Three/ }).click();
  await expect(panel(page).getByRole('heading')).toHaveText('No quests yet');
  await expect(quests(page).getByRole('option')).toHaveCount(0);
  await expect(line(page)).toContainText('No quests yet.');
});

test('a quest’s address opens straight on it; one that isn’t there opens the profile', async ({ page }) => {
  await page.goto('/member/sample-player-1/quest/3');
  await expect(page.locator('.quest-screen').getByRole('heading', { level: 2 })).toHaveText('Sample Quest Three');
  await page.goto('/member/sample-player-1/quest/9');
  await expect(page.locator('#profile-name')).toHaveText('Sample Player 1');
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and keyboard');

  test('keyboard only: ←/→ players, ↑/↓ quests, V views, Enter flips; each arc is a listbox', async ({ page }) => {
    await page.goto('/');
    const screen = page.getByRole('region', { name: /PIP-Hall players and their quests/ });
    await screen.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 4/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest 3');
    await page.keyboard.press('ArrowUp');
    await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest 2');
    await page.keyboard.press('Enter'); // Pip jumps; the badge flips on contact
    await expect(page.locator('.circles .badge')).toHaveAttribute('data-flipped', 'true');
    await page.keyboard.press('v');
    await expect(page).toHaveURL(/\/member\/sample-player-4\/quest\/2$/);
    await expect(page.locator('.quest-screen').getByRole('button', { name: /BACK/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.quest-screen')).toHaveCount(0);

    // The quests' arc on its own: arrows, End, Enter.
    await quests(page).focus();
    await page.keyboard.press('End');
    await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 6 of 6: Sample Quest 6');
    await page.keyboard.press('ArrowUp');
    await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 5 of 6: Sample Quest 5');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/quest\/5$/);
  });

  test('the mouse wheel turns an arc', async ({ page }) => {
    await page.goto('/');
    await players(page).getByRole('option', { selected: true }).hover();
    await page.mouse.wheel(0, 70);
    await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 2/);
  });
});

test('START switches to walking the level and back, and this device remembers', async ({ page }) => {
  await page.goto('/');
  await expect(players(page)).toBeVisible();
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: /Walk the level/ }).click();
  await expect(page.locator('.slot').first()).toBeVisible();
  await expect(players(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.slot').first()).toBeVisible();
  await page.getByRole('button', { name: 'START' }).click();
  await page.getByRole('button', { name: /Two circles/ }).click();
  await expect(players(page)).toBeVisible();
});

test('reduced motion: the arcs and Pip move without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await players(page).getByRole('option', { name: /Sample Player 2/ }).click();
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 2/);
  // Already in place: the chosen tile sits at the apex at once.
  const box = await players(page).getByRole('option', { selected: true }).boundingBox();
  await page.waitForTimeout(300);
  expect(await players(page).getByRole('option', { selected: true }).boundingBox()).toEqual(box);
});
