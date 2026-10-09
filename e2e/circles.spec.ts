// The two circles are the badge's back (D-129, D-132): the hall opens in the level, and flipping a
// badge to its Quest Log brings the players onto one arc and the chosen player's quests onto the
// other, their badge (still on its back) and the chosen quest between. Choosing another player turns
// the quests over to theirs; VIEW opens a quest inside the device; flipping the badge to its front
// brings the level back. Runs on the fixture data, on desktop and phone.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const EVIDENCE = 'docs/build/evidence/circles';
mkdirSync(EVIDENCE, { recursive: true });

const players = (p: Page) => p.getByRole('listbox', { name: 'Players' });
const quests = (p: Page) => p.locator('#hall-quests');
const panel = (p: Page) => p.locator('.quest-panel');
const line = (p: Page) => p.locator('.screen .dialogue .sr-only').first();
const levelBadge = (p: Page) => p.locator('.slot:not([aria-hidden]) .badge');
const circlesBadge = (p: Page) => p.locator('.circles .badge');
const flip = (p: Page) => p.getByRole('button', { name: 'FLIP', exact: true }).first();

/** FLIP in the level: the badge turns to its back and the circles come round it. */
async function toCircles(page: Page) {
  await expect(levelBadge(page)).toBeVisible();
  await flip(page).click();
  await expect(circlesBadge(page)).toHaveAttribute('data-flipped', 'true');
  await expect(players(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
});

test('the hall opens in the level; a badge on its back brings the circles, on its front the level again', async ({ page }, info) => {
  await page.goto('/');
  await expect(levelBadge(page)).toHaveAttribute('data-flipped', 'false');
  await expect(players(page)).toHaveCount(0);

  await toCircles(page);
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName('Sample Player 1, player 1 of 6');
  await expect(quests(page)).toHaveAccessibleName('Sample’s quests');
  await expect(quests(page).getByRole('option')).toHaveCount(3);
  await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest One');
  await expect(line(page)).toContainText('Their quests, round the badge.');
  await expect(page.locator('.slot')).toHaveCount(0);
  await page.waitForTimeout(800); // the arcs come to rest
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/hall-${info.project.name}.png` });

  // Another player: their quests take over the other arc, and their badge shows its back too.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next player' }).click();
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName('Sample Player 4, player 4 of 6');
  await expect(quests(page).getByRole('option')).not.toHaveCount(3);
  await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 1 of 6: Sample Quest 1');
  await expect(circlesBadge(page)).toHaveAttribute('data-flipped', 'true');
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

  // The badge turned to its front: the level, on the same player, every badge on its front.
  await flip(page).click();
  await expect(players(page)).toHaveCount(0);
  await expect(levelBadge(page)).toHaveAttribute('data-flipped', 'false');
  await expect(levelBadge(page)).toContainText('Sample Player 4');
  await expect(page.locator('.badge[data-flipped="true"]')).toHaveCount(0);
  await expect(line(page)).toContainText('Back in the level.');
});

test('a player with no quests says so', async ({ page }) => {
  await page.goto('/');
  await toCircles(page);
  await page.getByRole('button', { name: 'Next player' }).click();
  await players(page).getByRole('option', { name: /Sample Player Three/ }).click();
  await expect(panel(page).getByRole('heading')).toHaveText('No quests yet');
  await expect(quests(page).getByRole('option')).toHaveCount(0);
  await expect(line(page)).toContainText('No quests yet.');
});

test('a quest’s address opens straight on it, with the circles behind; one that isn’t there opens the profile', async ({ page }) => {
  await page.goto('/member/sample-player-1/quest/3');
  const screen = page.locator('.quest-screen');
  await expect(screen.getByRole('heading', { level: 2 })).toHaveText('Sample Quest Three');
  await screen.getByRole('button', { name: /BACK/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(quests(page).getByRole('option', { selected: true })).toHaveAccessibleName('Quest 3 of 3: Sample Quest Three');
  await expect(circlesBadge(page)).toHaveAttribute('data-flipped', 'true');
  await page.goto('/member/sample-player-1/quest/9');
  await expect(page.locator('#profile-name')).toHaveText('Sample Player 1');
});

test('the hall always opens in the level', async ({ page }) => {
  await page.goto('/');
  await toCircles(page);
  await page.reload();
  await expect(levelBadge(page)).toHaveAttribute('data-flipped', 'false');
  await expect(players(page)).toHaveCount(0);
  // START has no view switch: the badge is the way in and out.
  await page.getByRole('button', { name: 'START', exact: true }).click();
  await expect(page.getByRole('region', { name: 'START', exact: true })).not.toContainText('circles');
});

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and keyboard');

  test('keyboard only: Enter turns the badge over and back; ←/→ players, ↑/↓ quests, V views; each arc is a listbox', async ({ page }) => {
    await page.goto('/');
    const screen = page.getByRole('region', { name: /PIP-Hall players/ });
    await screen.focus();
    await page.keyboard.press('Enter'); // Pip jumps; the badge turns to its back on contact
    await expect(players(page)).toBeVisible();
    await expect(screen).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 4/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest 3');
    await page.keyboard.press('ArrowUp');
    await expect(panel(page).getByRole('heading')).toHaveText('Sample Quest 2');
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
    await expect(page.locator('.quest-screen').getByRole('button', { name: /BACK/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.quest-screen')).toHaveCount(0);

    // Enter on the screen turns the badge to its front: the level, on the same player.
    await screen.focus();
    await page.keyboard.press('Enter');
    await expect(players(page)).toHaveCount(0);
    await expect(levelBadge(page)).toContainText('Sample Player 4');
    await expect(screen).toBeFocused();
  });

  test('the mouse wheel turns an arc', async ({ page }) => {
    await page.goto('/');
    await toCircles(page);
    await players(page).getByRole('option', { selected: true }).hover();
    await page.mouse.wheel(0, 70);
    await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 2/);
  });

  test('sharp: the chosen tiles sit on whole pixels at full size, and the badge at a whole-pixel scale', async ({ page }) => {
    await page.goto('/');
    await toCircles(page);
    await page.waitForTimeout(800);
    for (const id of ['#hall-members', '#hall-quests']) {
      const m = await page.locator(`${id} .arc-option[data-chosen]`).evaluate((el) => {
        const t = new DOMMatrix(getComputedStyle(el).transform);
        return { a: t.a, d: t.d, e: t.e, f: t.f };
      });
      expect([m.a, m.d]).toEqual([1, 1]);
      expect(Number.isInteger(m.e) && Number.isInteger(m.f)).toBe(true);
    }
    const hang = await page.locator('.circles-hang').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect([1, 0.75, 0.5]).toContain(Number(hang.toFixed(4)));
    // Photos and screenshots are smoothed as they shrink; only pixel art keeps hard pixels.
    expect(await page.locator('.quest-panel .quest-art').evaluate((el) => {
      const probe = document.createElement('img');
      el.appendChild(probe);
      const r = getComputedStyle(probe).imageRendering;
      probe.remove();
      return r;
    })).toBe('auto');
  });
});

test('reduced motion: the badge turns over at once, and the arcs and Pip move without animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await flip(page).click();
  await expect(players(page)).toBeVisible();
  await players(page).getByRole('option', { name: /Sample Player 2/ }).click();
  await expect(players(page).getByRole('option', { selected: true })).toHaveAccessibleName(/Sample Player 2/);
  // Already in place: the chosen tile sits at the apex at once.
  const box = await players(page).getByRole('option', { selected: true }).boundingBox();
  await page.waitForTimeout(300);
  expect(await players(page).getByRole('option', { selected: true }).boundingBox()).toEqual(box);
});
