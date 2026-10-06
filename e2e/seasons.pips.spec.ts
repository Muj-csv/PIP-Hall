// V2-7 (D-103): an event (e.g. Build Week) shows a banner on every page, a panel in the hall with
// real counts, an event Mission (members claim PIPs, guests get a stamp) and a limited frame in
// the PIP MART. Admins schedule it in Admin → Events. Supabase data source, mocked, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const others = ['00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203'];

/** A date on the hall's calendar (Manila), `days` from today. */
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

function card(id: string, username: string, no: number): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, skills: [], projects: [], department: null, username, full_name: `Player ${username}`, is_featured: false } };
}

function hall(from: number, to: number): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1));
  others.forEach((id, i) => db.published.push(card(id, `player-${i + 2}`, i + 2)));
  db.ledger = [{ id: 1, member_id: ME.id, amount: 1000, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  db.seasons = [
    {
      key: 'build-week',
      name: 'Build Week',
      blurb: 'Ship something small.',
      starts_on: day(from),
      ends_on: day(to),
      mission: { kind: 'people', param: null, n: 3, reward: 30 },
      frame: { key: 'pearl', name: 'Pearl Frame', price: 700 },
      counts: { joined: 2, projects: 3, exhibits: 1, teamups: 0 },
    },
  ];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('during Build Week: a banner everywhere, real counts, the event Mission pays once, a limited frame', async ({ page }) => {
  const db = hall(-1, 5);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');

  const banner = page.getByRole('complementary', { name: 'Event' });
  await expect(banner).toContainText('Build Week');
  await expect(banner).toContainText('Ship something small.');
  const panel = page.locator('#event');
  await expect(panel).toContainText('So far: 2 joined · 3 projects · 1 exhibit · 0 team-ups');
  const mission = panel.locator('.mission');
  await expect(mission).toContainText('Meet 3 people you haven’t met');
  await expect(mission).toContainText('+30 PIPs, once');
  await expect(mission).toHaveAttribute('data-state', 'open');
  await expect(panel).toContainText('the Pearl Frame is in the PIP MART');

  for (let i = 2; i <= 4; i++) {
    await page.goto(`/member/player-${i}`);
    await expect(page.locator('.profile-screen .dialogue').first()).toContainText('+5 PIPs');
  }
  await page.goto('/#event');
  await expect(mission).toHaveAttribute('data-state', 'ready');
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: 'docs/build/evidence/events/event-panel.png' });
  const before = Number((await page.locator('.hud-coins').textContent())!.replace(/\D/g, ''));
  await mission.getByRole('button', { name: /^Claim/ }).click();
  await expect(panel.getByRole('status')).toHaveText('Event Mission complete! +30 PIPs.');
  await expect(mission).toHaveAttribute('data-state', 'done');
  await expect(page.locator('.hud-coins')).toHaveText(`×${before + 30}`);
  expect(db.ledger!.filter((r) => r.ref === 'mission:season:build-week').map((r) => r.amount)).toEqual([30]);

  // The banner is on every page; the limited frame is in the Mart until the last day.
  await page.goto('/mart');
  await expect(page.getByRole('complementary', { name: 'Event' })).toContainText('Build Week');
  await expect(page.locator('.mart-row').filter({ hasText: 'Pearl Frame' })).toContainText('Limited: on sale until');
  await page.getByRole('complementary', { name: 'Event' }).screenshot({ path: 'docs/build/evidence/events/banner.png' });
});

test('guests do the event Mission for a stamp', async ({ page }) => {
  const db = hall(-1, 5);
  await boot(page);
  await mockSupabase(page, { db, publishedCards: db.published });
  await page.goto('/');
  const mission = page.locator('#event .mission');
  await expect(mission).toContainText('stamp');
  for (let i = 2; i <= 4; i++) {
    await page.goto(`/member/player-${i}`);
    await expect(page.locator('.profile-screen')).toBeVisible();
  }
  await page.goto('/');
  await expect(mission).toHaveAttribute('data-state', 'done');
});

test('before an event: “Coming up” in the banner, no event panel, the limited frame not yet for sale', async ({ page }) => {
  const db = hall(3, 9);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Event' })).toContainText('Coming up: Build Week');
  await expect(page.locator('#event')).toHaveCount(0);
  await page.goto('/mart');
  await expect(page.locator('.mart-row').filter({ hasText: 'Dusk Frame' })).toBeVisible();
  await expect(page.locator('.mart-row').filter({ hasText: 'Pearl Frame' })).toHaveCount(0);
});

test('an admin schedules an event in Admin → Events', async ({ page }) => {
  const db = hall(40, 41);
  db.seasons = [];
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Events' }).click();
  await expect(page.locator('.dialogue').filter({ hasText: 'No events yet' })).toBeVisible();
  const form = page.getByRole('form', { name: 'Schedule an event' });
  await form.getByLabel('Name').fill('Build Week');
  await form.getByLabel('First day').fill(day(0));
  await form.getByLabel('Last day').fill(day(6));
  await form.getByLabel('Banner line').fill('Ship something small.');
  await form.getByLabel('Event Mission').selectOption('people');
  await form.getByLabel('How many').fill('3');
  await form.getByLabel('PIPs it pays (5–200)').fill('30');
  await form.getByLabel('Limited frame').selectOption('pearl');
  await form.getByRole('button', { name: 'Schedule event' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Build Week is scheduled.' })).toBeVisible();
  const row = page.getByRole('list', { name: 'Scheduled events' }).locator('.mart-row');
  await expect(row).toContainText('★ On now');
  await expect(row).toContainText('Mission +30 PIPs');
  expect(db.seasons[0]).toMatchObject({ key: 'build-week', mission: { kind: 'people', n: 3, reward: 30 }, frame: { key: 'pearl' } });
  await page.locator('section[aria-labelledby="events-title"]').screenshot({ path: 'docs/build/evidence/events/admin-events.png' });
});
