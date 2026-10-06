// V2-5 (D-101): titles earned from behaviour, title plates in the PIP MART, the Proof panel, and
// Mission rerolls. Supabase data source, mocked, PIPs on. The database rules are in
// supabase/tests/security.test.mjs; here the mock is told which titles a member has earned.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const others = ['00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203'];

function card(id: string, username: string, no: number, bare = false): Row {
  const base = samples[0]!;
  const c = bare ? { ...base.card, skills: [], projects: [], department: null } : base.card;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...c, username, full_name: `Player ${username}`, is_featured: false, github_username: 'me-player' } };
}

function hall(pips: number, bare = true): MockDb {
  const db = emptyDb();
  db.identity = true;
  db.published.push(card(ME.id, 'me-player', 1));
  others.forEach((id, i) => db.published.push(card(id, `player-${i + 2}`, i + 2, bare)));
  db.earned = { [ME.id]: ['pioneer', 'explorer'] };
  db.ledger = [{ id: 1, member_id: ME.id, amount: pips, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
const row = (page: Page, name: string) => page.locator('.mart-row').filter({ has: page.getByText(name, { exact: true }) });

test('wear an earned title, buy a plate for it, and the profile proves it', async ({ page }) => {
  const db = hall(400);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/mart');

  const titles = page.getByRole('region', { name: 'Your title' });
  await expect(row(page, 'Pioneer')).toContainText('Earned');
  await expect(row(page, 'Curator')).toContainText('Not earned yet');
  await expect(row(page, 'Curator').getByRole('button')).toHaveCount(0); // never bought, only earned
  await row(page, 'Pioneer').getByRole('button', { name: 'Wear Pioneer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your badge now says Pioneer.' })).toBeVisible();
  await expect(row(page, 'Pioneer')).toContainText('✓ Wearing');
  const plate = page.locator('.preview-stage .badge-title');
  await expect(plate).toHaveText('Title: Pioneer');
  await expect(plate).not.toHaveAttribute('data-plate');

  // Try a plate on for free, then buy it and wear it.
  await row(page, 'Plum Enamel Plate').getByRole('button', { name: 'Try on' }).click();
  await expect(plate).toHaveAttribute('data-plate', 'bought');
  await row(page, 'Brass Plate').getByRole('button', { name: /Buy for 150/ }).click();
  await row(page, 'Brass Plate').getByRole('button', { name: /Yes, spend 150 PIPs/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Wear it now/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your title is on the Brass Plate now.' })).toBeVisible();
  await expect(row(page, 'Brass Plate')).toContainText('✓ Wearing');
  await expect(titles).toBeVisible();
  await page.locator('.mart-layout').screenshot({ path: 'docs/build/evidence/identity/mart-titles-plates.png' });

  // Everyone sees it: the badge in the hall and the profile's Proof panel.
  await page.goto('/member/me-player');
  await expect(page.locator('.profile-screen .badge-title')).toHaveText('Title: Pioneer');
  const proof = page.getByRole('region', { name: 'Proof' });
  await expect(proof).toContainText('GitHub verified: @me-player');
  await expect(proof).toContainText('Card approved');
  await expect(proof).toContainText('Pioneer: One of the hall’s first 10 members.');
  await expect(proof).toContainText('Explorer: Met 10 members of the hall.');
  await expect(proof).not.toContainText('Curator');
  await proof.scrollIntoViewIfNeeded();
  await proof.screenshot({ path: 'docs/build/evidence/identity/proof-panel.png' });
  expect(db.ledger!.filter((r) => r.reason === 'purchase').map((r) => r.amount)).toEqual([-150]);
});

test('a member swaps today’s Missions once, for 15 PIPs', async ({ page }) => {
  const db = hall(150, false);
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');
  const today = page.getByRole('list', { name: 'Today’s Missions' });
  await expect(today.locator('li').first()).toBeVisible();
  const before = await today.locator('li').allTextContents();
  await page.getByRole('button', { name: 'New set for today · 15 PIPs' }).click();
  await expect(page.locator('.missions-panel').getByRole('status')).toHaveText('New Missions for today! −15 PIPs.');
  await expect(page.locator('.hud-coins')).toHaveText('×135');
  await expect(page.getByRole('button', { name: /New set for today/ })).toHaveCount(0); // once a day
  expect(db.rerolls).toHaveLength(1);
  // A fresh set, drawn from the same real hall with the reroll in its seed.
  await expect.poll(async () => (await today.locator('li').allTextContents()).join()).not.toBe(before.join());
});

test('before the identity update, the PIP MART and profiles carry on without titles', async ({ page }) => {
  const db = hall(400);
  db.identity = false;
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/mart');
  await expect(page.getByRole('region', { name: 'Frames' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your title' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Title plates' })).toHaveCount(0);
  await page.goto('/member/me-player');
  await expect(page.getByRole('region', { name: 'Proof' })).toContainText('GitHub verified');
  await expect(page.locator('.profile-screen .badge-title')).toHaveCount(0);
});
