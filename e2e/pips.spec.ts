// PIP Progression E1 acceptance (docs/plan/PIP-PROGRESSION-E1.md §7). Runs on the Supabase data
// source with VITE_FEATURE_PIPS=on (playwright.config.ts); Supabase is the stateful mock.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, rewardApproval, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const ids = Array.from({ length: 12 }, (_, i) => `00000000-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`);

/** A published card shaped like the real snapshot, for the hall and profile screen. */
function card(id: string, username: string, no: number): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, username, full_name: `Player ${username}`, is_featured: false } };
}

/** Me in the hall (with my approval rewards backfilled), plus `others` members. */
function hall(others = 3): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1));
  ids.slice(0, others).forEach((id, i) => db.published.push(card(id, `player-${i + 1}`, i + 2)));
  rewardApproval(db, ME.id); // welcome 100 + Card Holder 50
  return db;
}

const hudCoins = (page: Page) => page.locator('.hud-coins');
const reward = (page: Page) => page.locator('.profile-screen .dialogue .sr-only');
const boot = (page: Page) => page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));

test('opening a new member pays +5 once; Pip says so; the HUD shows the balance', async ({ page }) => {
  const db = hall();
  const log = await mockSupabase(page, { user: ME, db });
  await boot(page);
  await page.goto('/');
  await expect(hudCoins(page)).toHaveText('×150');
  await expect(hudCoins(page)).toHaveAttribute('data-pips', 'true');

  await page.goto('/member/player-1');
  await expect(reward(page)).toHaveText('You found someone new! +5 PIPs.');
  await page.locator('.profile-screen').getByRole('button', { name: /◀ BACK/ }).click();
  await expect(hudCoins(page)).toHaveText('×155');

  // Again: nothing more (and not even asked twice in one visit).
  await page.goto('/member/player-1');
  await expect(page.locator('#profile-name')).toHaveText('Player player-1');
  await expect(reward(page)).toHaveCount(0);
  expect(db.ledger!.filter((r) => r.reason === 'discover')).toHaveLength(1);
  // Opening your own card earns nothing.
  await page.goto('/member/me-player');
  await expect(page.locator('#profile-name')).toHaveText('Player me-player');
  expect(log.requests.filter((r) => r.includes('discover_card'))).toHaveLength(2); // player-1 on two separate loads
});

test('past the daily cap a discovery pays nothing but still counts toward Explorer', async ({ page }) => {
  const db = hall(10);
  for (let i = 0; i < 19; i++) db.ledger!.push({ id: 900 + i, member_id: ME.id, amount: 5, reason: 'discover', ref: `old-${i}`, created_at: new Date().toISOString() });
  for (const id of ids.slice(3, 10)) db.discoveries = [...(db.discoveries ?? []), { member_id: ME.id, card_id: id }];
  await mockSupabase(page, { user: ME, db });
  await page.goto('/member/player-1');
  await expect(reward(page)).toHaveText('You found someone new! +5 PIPs.');
  await page.goto('/member/player-2');
  await expect(reward(page)).toContainText('maxed for today');
  await page.goto('/member/player-3');
  await expect(reward(page)).toContainText('ACHIEVEMENT: Explorer! +100 PIPs.');
});

test("another member's achievements are public; their balance never shows", async ({ page }) => {
  const db = hall();
  rewardApproval(db, ids[0]!); // player-1: Card Holder
  await mockSupabase(page, { user: ME, db });
  await page.goto('/member/player-1');
  await expect(page.locator('.profile-screen').getByRole('list', { name: 'Achievements' })).toHaveText(/Card Holder/);
  await expect(page.locator('.profile-screen')).not.toContainText(/\d+ PIPs\b(?!\.)/);
});

test('admin approval pays the new member: 100 + Card Holder 50 + 2 projects × 25 + First Quest 50 = 250', async ({ page }) => {
  const db = hall(0);
  const NEW = ids[11]!;
  db.profiles.push({ id: NEW, username: 'newbie', full_name: 'New Bie', tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'pending_review', review_note: null, is_featured: false, username_locked: false, member_no: null, submitted_at: '2026-10-05T00:00:00Z' });
  for (const t of ['One', 'Two']) db.projects.push({ id: crypto.randomUUID(), profile_id: NEW, source: 'manual', github_repo_id: null, title: t, description: null, tech_stack: [], sort_order: 0 });
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Approve card' }).click();
  await expect(page.locator('main > .notice')).toContainText('Approved New Bie');
  const balance = db.ledger!.filter((r) => r.member_id === NEW).reduce((n, r) => n + Number(r.amount), 0);
  expect(balance).toBe(250);
});

test('a signed-in member without a card in the hall keeps the flip toy and never discovers', async ({ page }) => {
  const db = emptyDb();
  db.published.push(card(ids[0]!, 'player-1', 1));
  const log = await mockSupabase(page, { user: ME, db });
  await boot(page);
  await page.goto('/');
  await expect(hudCoins(page)).toHaveText('×00');
  await expect(hudCoins(page)).not.toHaveAttribute('data-pips', 'true');
  await page.goto('/member/player-1');
  await expect(page.locator('#profile-name')).toHaveText('Player player-1');
  await page.waitForTimeout(300);
  expect(log.requests.some((r) => r.includes('discover_card'))).toBe(false);
});

test('Settings shows the private balance and history, newest first', async ({ page }) => {
  const db = hall();
  await mockSupabase(page, { user: ME, db });
  await page.goto('/member/player-2');
  await expect(reward(page)).toContainText('+5 PIPs');
  await page.goto('/settings');
  const panel = page.getByRole('region', { name: 'PIPs' });
  await expect(panel).toContainText('155 PIPs');
  await expect(panel.getByRole('list', { name: 'PIP history' }).getByRole('listitem')).toHaveText([/Discovered a member.*\+5/, /Achievement: Card Holder.*\+50/, /Your card joined the hall.*\+100/]);
});
