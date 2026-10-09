// PIP MART v1 (docs/plan/PIP-PROGRESSION-E2.md, D-074…D-076). Supabase data source, mocked, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';
import { inLevel } from './level';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const OTHER = '00000000-0000-4000-8000-000000000201';

function card(id: string, username: string, no: number): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, username, full_name: `Player ${username}`, is_featured: false } };
}

/** Me in the hall with `pips` PIPs, plus one other member. */
function hall(pips = 500): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1), card(OTHER, 'player-2', 2));
  db.ledger = [{ id: 1, member_id: ME.id, amount: pips, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  return db;
}

const boot = async (page: Page) => {
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await inLevel(page); // the badges hang in the level here
};
const preview = (page: Page) => page.locator('.preview-stage .badge');
const balance = (page: Page) => page.getByRole('status').filter({ hasText: 'PIPs' }).first();
const row = (page: Page, name: string) => page.locator('.mart-row').filter({ hasText: name });

test('try a frame on, buy one, wear it: the hall shows it to everyone', async ({ page, browser }) => {
  const db = hall(500);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');
  await page.getByRole('link', { name: 'PIP MART' }).click();
  await expect(page).toHaveURL(/\/mart$/);
  await expect(balance(page)).toHaveText(/500 PIPs/);
  await expect(preview(page)).not.toHaveAttribute('data-frame');

  // Trying on costs nothing.
  await row(page, 'Dusk Frame').getByRole('button', { name: 'Try on' }).click();
  await expect(preview(page)).toHaveAttribute('data-frame', 'dusk');
  await expect(page.getByText('Trying on', { exact: false }).first()).toBeVisible();

  // Too expensive says how far off; affordable asks first.
  await expect(row(page, 'Pearl Frame')).toContainText('Need 200 more PIPs');
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Buy for 200' }).click();
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Keep my PIPs' }).click();
  expect(db.inventory ?? []).toHaveLength(0);
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Buy for 200' }).click();
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Yes, spend 200 PIPs' }).click();
  // The frame arrives in an unboxing dialog; Later keeps the current look.
  const unbox = page.getByRole('dialog', { name: 'NEW FRAME!' });
  await expect(unbox).toContainText('The Meadow Frame is yours to keep.');
  await expect(unbox.getByRole('button', { name: 'Wear it now' })).toBeFocused();
  await unbox.getByRole('button', { name: 'Later' }).click();
  await expect(unbox).toHaveCount(0);
  await expect(page.locator('.notice')).toHaveText('Meadow Frame is yours! Wear it whenever you like.');
  await expect(balance(page)).toHaveText(/300 PIPs/);
  await expect(row(page, 'Meadow Frame')).toContainText('Owned');
  expect(db.ledger!.find((r) => r.reason === 'purchase')).toMatchObject({ amount: -200, ref: 'buy:meadow' });

  await row(page, 'Meadow Frame').getByRole('button', { name: 'Wear' }).click();
  await expect(page.locator('.notice')).toHaveText('Wearing the Meadow Frame.');
  await expect(row(page, 'Meadow Frame')).toContainText('✓ Wearing');

  // A visitor sees it in the hall.
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await boot(visitor);
  await mockSupabase(visitor, { db });
  await visitor.goto('http://localhost:5174/');
  await expect(visitor.locator('.slot:not([aria-hidden]) .badge')).toHaveAttribute('data-frame', 'meadow');
  await ctx.close();
});

test('wear it now from the unboxing puts the new frame straight on the badge', async ({ page }) => {
  const db = hall(500);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/mart');
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Buy for 200' }).click();
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Yes, spend 200 PIPs' }).click();
  await page.getByRole('dialog', { name: 'NEW FRAME!' }).getByRole('button', { name: 'Wear it now' }).click();
  await expect(page.locator('.notice')).toHaveText('Wearing the Meadow Frame.');
  await expect(row(page, 'Meadow Frame')).toContainText('✓ Wearing');
  await expect(preview(page)).toHaveAttribute('data-frame', 'meadow');
  await expect(preview(page)).toHaveAttribute('data-foil', 'true');
});

test('an affiliation that gives a member frame lets its members wear it free, printed with its name', async ({ page }) => {
  const db = hall(50);
  db.affiliations = [{ key: 'code-guild', name: 'Code Guild', grants_museum: false, frame_key: 'member', sort: 1 }];
  db.memberAffiliations = [{ member_id: ME.id, key: 'code-guild' }];
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/mart');
  const perk = row(page, 'CODE GUILD MEMBER frame');
  await expect(perk).toContainText('Free with your Code Guild affiliation.');
  await perk.getByRole('button', { name: 'Wear' }).click();
  await expect(page.locator('.notice')).toHaveText('Wearing the CODE GUILD MEMBER frame.');
  await expect(preview(page)).toHaveAttribute('data-frame', 'member');
  await expect(preview(page).locator('.badge-face[data-side="front"] .holder-print')).toHaveText('CODE GUILD MEMBER');
  await expect(balance(page)).toHaveText(/50 PIPs/); // free

  await page.goto('/');
  await expect(page.locator('.slot:not([aria-hidden]) .badge .holder-print').first()).toHaveText('CODE GUILD MEMBER');
});

test('a member without a card in the hall is told the Mart opens after approval', async ({ page }) => {
  const db = emptyDb();
  await mockSupabase(page, { user: ME, db });
  // The hall's cards arrive after the Mart's answer (the order CI hit): one message, not two.
  await page.route('**/rest/v1/published_cards*', async (r) => {
    await new Promise((done) => setTimeout(done, 1500));
    await r.fallback();
  });
  await page.goto('/mart');
  await expect(page.locator('.dialogue .sr-only')).toContainText('opens once your card is in the hall');
  await expect(page.locator('.dialogue')).toHaveCount(1); // never alongside the loading line
  await expect(page.locator('.dialogue').getByRole('link', { name: 'MY CARD', exact: true })).toBeVisible();
});

test('admins choose which affiliations give a member frame', async ({ page }) => {
  const db = hall();
  db.affiliations = [{ key: 'code-guild', name: 'Code Guild', grants_museum: false, frame_key: null, sort: 1 }];
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Affiliations' }).click();
  await page.getByRole('button', { name: 'Give member frame' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Code Guild members can now wear a member frame.');
  expect(db.affiliations[0]!.frame_key).toBe('member');
  await expect(page.getByText('member frame', { exact: true })).toBeVisible();
});

test('a database without the PIP MART update says so, instead of blaming the connection', async ({ page }) => {
  await mockSupabase(page, { user: ME, db: hall() });
  await page.route('**/rest/v1/rpc/my_mart', (r) =>
    r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.my_mart without parameters in the schema cache', details: null, hint: null }) }),
  );
  await page.goto('/mart');
  await expect(page.locator('.dialogue .sr-only')).toContainText('isn’t set up in this hall’s database yet');
});
