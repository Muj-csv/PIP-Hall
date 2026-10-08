// V2-4 (D-100): the bell for members and "Recent in the hall" for everyone, read from hall_events
// (mocked here; the database rules are in supabase/tests/security.test.mjs).
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const OTHER = '00000000-0000-4000-8000-0000000000b2';
const minutes = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const skip = async (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

function note(id: number, type: string, at: string, extra: Row = {}): Row {
  return { id, recipient: ME.id, type, at, target_type: null, target_id: null, title: null, note: null, by_username: null, by_name: null, ...extra };
}

test('the bell shows what’s new, marks it seen, and each line goes where you can act', async ({ page }) => {
  const db = emptyDb();
  db.published.push(...(samples as Row[]));
  db.notifications = [
    note(1, 'CARD_APPROVED', minutes(60 * 30), { target_type: 'card', target_id: 'sample-player-1' }),
    note(2, 'ACHIEVEMENT_UNLOCKED', minutes(60 * 30), { target_type: 'achievement', target_id: 'first_card', title: 'Card Holder' }),
    note(3, 'COLLAB_REQUESTED', minutes(5), { target_type: 'project', target_id: 'p-1', title: 'TESSERA', by_username: 'sample-player-2', by_name: 'Sample Player 2' }),
    note(4, 'CARD_REJECTED', minutes(2), { target_type: 'card', note: 'Add a project link, please' }),
    { ...note(5, 'CARD_APPROVED', minutes(1)), recipient: OTHER }, // someone else's
  ];
  db.notificationSeen = { [ME.id]: minutes(60) };
  await skip(page);
  await mockSupabase(page, { user: ME, db });

  await page.goto('/museum');
  const bell = page.getByRole('button', { name: /Notifications/ });
  await expect(bell).toHaveAccessibleName('Notifications 2 new');
  await bell.click();
  await expect(bell).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('region', { name: 'Notifications' });
  const items = panel.getByRole('listitem');
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toContainText('NEW');
  await expect(items.nth(0)).toContainText('Your card needs changes: Add a project link, please');
  await expect(items.nth(1)).toContainText('Sample Player 2 tagged you on “TESSERA”');
  await expect(items.nth(1)).toContainText('5 min ago');
  await expect(items.nth(2)).not.toContainText('NEW');
  await expect(items.nth(2)).toContainText('Achievement unlocked: Card Holder!');
  await expect(items.nth(2).getByRole('link')).toHaveAttribute('href', '/member/sample-player-1');
  await expect(bell).toHaveAccessibleName('Notifications'); // seen
  expect(db.notificationSeen[ME.id]! > minutes(1)).toBe(true);
  await page.screenshot({ path: 'docs/build/evidence/notifications/bell-open.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/build/evidence/notifications/bell-open-phone.png' });

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(bell).toBeFocused();

  await bell.click();
  await items.nth(1).getByRole('link').click();
  await expect(page).toHaveURL(/\/edit#collaborators$/);
  await expect(page.getByRole('region', { name: 'Notifications' })).toBeHidden();
});

test('an empty bell says so; without the V2-4 update there is no bell', async ({ page }) => {
  const db = emptyDb();
  db.notifications = [];
  await skip(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/museum');
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByRole('region', { name: 'Notifications' }).locator('.dialogue')).toContainText('Nothing yet');

  delete db.notifications;
  await page.reload();
  await expect(page.getByRole('link', { name: 'Museum', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0);
});

test('visitors see Recent in the hall: real public events that lead to the member', async ({ page }) => {
  const db = emptyDb();
  db.recentEvents = [
    { id: 9, type: 'COLLAB_PUBLISHED', at: minutes(3), username: 'sample-player-1', full_name: 'Sample Player 1', title: 'TESSERA', project_id: 'p-1', with_username: 'sample-player-2', with_name: 'Sample Player 2' },
    { id: 8, type: 'ACHIEVEMENT_UNLOCKED', at: minutes(90), username: 'sample-player-3', full_name: 'Sample Player 3', title: 'Explorer', project_id: null, with_username: null, with_name: null },
    { id: 7, type: 'CARD_APPROVED', at: minutes(60 * 50), username: 'sample-player-4', full_name: 'Sample Player 4', title: null, project_id: null, with_username: null, with_name: null },
  ];
  await skip(page);
  await mockSupabase(page, { db, publishedCards: samples });
  await page.goto('/');
  const strip = page.getByRole('region', { name: 'Recent in the hall' });
  const lines = strip.getByRole('listitem');
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText('Sample Player 1 and Sample Player 2 made “TESSERA” together.');
  await expect(lines.nth(1)).toContainText('Sample Player 3 unlocked Explorer.');
  await expect(lines.nth(2)).toContainText('Sample Player 4 joined the hall.');
  await expect(lines.nth(2)).toContainText('2 days ago');
  await expect(page.getByRole('button', { name: /Notifications/ })).toHaveCount(0); // visitors have no bell
  await strip.scrollIntoViewIfNeeded();
  await strip.screenshot({ path: 'docs/build/evidence/notifications/recent-in-the-hall.png' });

  await lines.nth(2).getByRole('link').click();
  await expect(page).toHaveURL(/\/member\/sample-player-4$/);
  await expect(page.locator('.profile-screen')).toBeVisible();
});

test('a quiet hall says so honestly', async ({ page }) => {
  const db = emptyDb();
  db.recentEvents = [];
  await skip(page);
  await mockSupabase(page, { db, publishedCards: samples });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Recent in the hall' }).locator('.dialogue')).toContainText('Nothing new yet');
});
