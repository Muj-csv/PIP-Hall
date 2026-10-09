// D-126 (owner feedback, 2026-10-08): a calmer hall. One search row (the search and its filters);
// Random player, the Passport, the Officers door, the map, the Museum, sharing and DAY/NIGHT are in
// the device's START menu (V2-15, D-107); below the device, one tab at a time. Supabase data, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/calm';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const minutes = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function hall(): MockDb {
  const db = emptyDb();
  db.published.push(...(samples as unknown as Row[]));
  db.notifications = [];
  db.recentEvents = [
    { id: 9, type: 'COLLAB_PUBLISHED', at: minutes(3), username: 'sample-player-1', full_name: 'Sample Player 1', title: 'TESSERA', project_id: 'p-1', with_username: 'sample-player-2', with_name: 'Sample Player 2' },
    { id: 7, type: 'CARD_APPROVED', at: minutes(60), username: 'sample-player-4', full_name: 'Sample Player 4', title: null, project_id: null, with_username: null, with_name: null },
  ];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('one search row above the device; everything else is one press of START away', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/');
  const search = page.getByRole('region', { name: 'Find players' });
  await expect(search.getByRole('searchbox', { name: 'Search players' })).toBeVisible();
  await expect(search.getByRole('button')).toHaveText([/Filters/]); // the only button above the device
  await expect(page.locator('header').getByRole('button', { name: /^World:/ })).toHaveCount(1); // one theme button, not three
  await expect(page.locator('.device').getByRole('button', { name: /DAY|NIGHT/ })).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCE}/home-desktop.png` });

  // START opens the menu inside the device; BACK (or OPEN, now BACK) closes it.
  const start = page.getByRole('button', { name: 'START', exact: true });
  await start.click();
  await expect(start).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('region', { name: 'START', exact: true });
  await expect(menu.getByRole('listitem')).toHaveText([/Walk the level/, /Random player/, /Passport/, /Museum/, /Share the hall/, /Night world|Day world/]);
  await expect(menu.getByRole('button', { name: /BACK to the hall/ })).toBeFocused();
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/start-menu.png` });
  await page.getByRole('button', { name: 'BACK', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(start).toHaveAttribute('aria-expanded', 'false');

  // From the keyboard: S opens it, Esc closes it and focus comes back to the hall.
  const screen = page.getByRole('region', { name: /^PIP-Hall players/ });
  await screen.focus();
  await page.keyboard.press('s');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(screen).toBeFocused();

  // An item does its job and closes the menu: Random player walks Pip to someone.
  await start.click();
  await menu.getByRole('button', { name: /Random player/ }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.screen .dialogue .sr-only').first()).toContainText('Random player:');
});

test('below the device, one tab at a time: Missions first, Recent one press away', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'In the hall' });
  await expect(tabs.getByRole('tab')).toHaveText([/Missions/, /Recent/]);
  await expect(tabs.getByRole('tab', { name: /Missions/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('list', { name: 'Today’s Missions' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent in the hall' })).toHaveCount(0); // hidden until picked

  await tabs.getByRole('tab', { name: /Missions/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: /Recent/ })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: /Recent/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Recent in the hall' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('list', { name: 'Today’s Missions' })).toBeHidden();
  await page.locator('.hall-tabs').screenshot({ path: `${EVIDENCE}/tabs.png` });

  await page.setViewportSize({ width: 412, height: 915 });
  await page.reload();
  await expect(tabs).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/home-phone.png`, fullPage: true });
});

test('while an event is on, its tab comes first', async ({ page }) => {
  const db = hall();
  db.seasons = [
    {
      key: 'build-week',
      name: 'Build Week',
      blurb: 'Ship something small.',
      starts_on: day(-1),
      ends_on: day(5),
      mission: { kind: 'people', param: null, n: 3, reward: 30 },
      frame: null,
      counts: { joined: 2, projects: 3, exhibits: 1, teamups: 0 },
    },
  ];
  await boot(page);
  await mockSupabase(page, { db });
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'In the hall' });
  await expect(tabs.getByRole('tab')).toHaveText([/Event/, /Missions/, /Recent/]);
  await expect(tabs.getByRole('tab', { name: /Event/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#event')).toContainText('Build Week');
  await tabs.getByRole('tab', { name: /Missions/ }).click();
  await expect(page.locator('#event')).toBeHidden();
  await expect(page.getByRole('list', { name: 'Today’s Missions' })).toBeVisible();
});
