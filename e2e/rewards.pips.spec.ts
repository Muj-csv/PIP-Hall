// Admin → Rewards (D-087): admins design borders and badges from presets and give badges; a badge
// pays its PIPs and gives its border, and pins a gem on the member's card. Mocked Supabase, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };

function card(id: string, username: string, no: number): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, username, full_name: `Player ${username}`, is_featured: false } };
}
function hall(): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1));
  db.ledger = [{ id: 1, member_id: ME.id, amount: 10, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  return db;
}
const boot = (page: Page) => page.addInitScript(() => { sessionStorage.setItem('piphall-booted', '1'); sessionStorage.setItem('piphall-splash', '1'); });
const rewardsTab = async (page: Page) => {
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Rewards' }).click();
};

test('an admin designs a reward border and a badge, gives it, and the member gets PIPs, the border and a pin', async ({ page, browser }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await rewardsTab(page);

  // A reward-only border, previewed live on a real badge.
  const borders = page.getByRole('region', { name: 'Borders' });
  await borders.getByLabel('Name').fill('Champion');
  await borders.getByLabel('Description').fill('For hackathon winners');
  await borders.getByLabel('Frame', { exact: true }).selectOption('gold');
  await borders.getByLabel('Motion').selectOption('flow');
  await expect(borders.locator('.rewards-preview .badge').first()).toHaveAttribute('data-motion', 'flow');
  await borders.getByLabel('Sold in the PIP MART').uncheck();
  await borders.getByRole('button', { name: 'Add border' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Added the Champion border.');
  await expect(borders.getByRole('list', { name: 'Designed borders' })).toContainText('Reward only');
  expect(db.customItems?.[0]).toMatchObject({ key: 'champion', for_sale: false, style: { frame: 'gold', motion: 'flow' } });

  // A badge that pays 150 PIPs and gives that border.
  const badges = page.getByRole('region', { name: 'Badges' });
  await badges.getByLabel('Name').fill('Hackathon Winner');
  await badges.getByLabel('PIP reward').fill('150');
  await badges.getByLabel('What it’s for').fill('Won a hall hackathon.');
  await badges.getByText('crown', { exact: true }).click();
  await badges.getByLabel('Gives a border').selectOption('champion');
  await badges.getByRole('button', { name: 'Add badge' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Added the Hackathon Winner badge.');
  expect(db.customBadges?.[0]).toMatchObject({ key: 'hackathon-winner', gem: 'crown', reward: 150, reward_frame: 'champion' });

  // Give it.
  const give = page.getByRole('region', { name: 'Give a badge' });
  await give.getByRole('button', { name: 'Give badge' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Gave Hackathon Winner to Player me-player.');
  await give.getByRole('button', { name: 'Give badge' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Player me-player already has Hackathon Winner.');

  // The member: 10 + 150 PIPs, and the reward border waits in the Mart, ready to wear.
  const ctx = await browser.newContext();
  const me = await ctx.newPage();
  await boot(me);
  await mockSupabase(me, { user: ME, db });
  await me.goto('/mart');
  await expect(me.getByRole('status').filter({ hasText: 'PIPs' }).first()).toHaveText(/160 PIPs/);
  const champion = me.locator('.mart-row').filter({ hasText: 'Champion' });
  await expect(champion).toContainText('Reward');
  await champion.getByRole('button', { name: 'Wear' }).click();
  await expect(me.locator('.preview-stage .badge')).toHaveAttribute('data-frame', 'custom');
  await ctx.close();

  // Visitors see the pin on the card and the badge on the profile.
  const vctx = await browser.newContext();
  const visitor = await vctx.newPage();
  await boot(visitor);
  await mockSupabase(visitor, { db });
  await visitor.goto('http://localhost:5174/member/me-player');
  await expect(visitor.locator('.profile-screen .badge').first().getByRole('list', { name: 'Badges' })).toContainText('Hackathon Winner');
  await expect(visitor.getByRole('list', { name: 'Achievements' })).toContainText('Hackathon Winner');
  await vctx.close();
});

test('taking a badge back removes the pin but leaves what it gave', async ({ page }) => {
  const db = hall();
  db.customItems = [{ key: 'champion', kind: 'frame', name: 'Champion', description: '', price: 1, for_sale: false, active: true, style: { frame: 'gold', hi: 'coin-hi', shade: 'block-shade', trim: 'ink', gap: 3, motion: 'flow', doodle: 'gold' }, sort: 100 }];
  db.customBadges = [{ key: 'mvp', name: 'MVP', description: 'Most valuable', reward: 50, sort: 100, custom: true, gem: 'star', tone: 'gold', reward_frame: 'champion' }];
  db.memberAchievements = [{ member_id: ME.id, key: 'mvp' }];
  db.inventory = [{ member_id: ME.id, item_key: 'champion' }];
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await rewardsTab(page);
  await page.getByRole('region', { name: 'Give a badge' }).getByRole('button', { name: 'Take back' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Took MVP back from Player me-player. What it gave stays theirs.');
  expect(db.memberAchievements).toHaveLength(0);
  expect(db.inventory).toHaveLength(1);
});

test('members never see the Rewards tools', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: 'Rewards' })).toHaveCount(0);
});
