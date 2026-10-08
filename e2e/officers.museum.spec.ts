// V2-10b (D-123): the officers' space. An admin makes an affiliation an officers' team for a term and
// names its officers with positions and an order. Visitors open the hall's Officers door (only the
// current officers, in their seats, with why), see the officer pin on badges and the positions on
// profiles (past terms marked past), and walk into the Museum's Officers' Wing. Supabase data, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, SEED_WINGS, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const ONE = '00000000-0000-4000-8000-000000000201';
const TWO = '00000000-0000-4000-8000-000000000202';
const THREE = '00000000-0000-4000-8000-000000000203';
const KITE = '33333333-0000-4000-8000-000000000001';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

function card(id: string, username: string, no: number, projects: Row[] = []): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: false,
    card: { ...base.card, skills: [], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, collaborators: [], ...p })) },
  };
}

function hall(): MockDb {
  const db = emptyDb();
  db.published.push(card(ONE, 'player-1', 1, [{ id: KITE, title: 'Kite' }]), card(TWO, 'player-2', 2), card(THREE, 'player-3', 3));
  db.wings = SEED_WINGS.map((w) => ({ ...w }));
  db.affiliations = [
    { key: 'officers-2026', name: 'Officers 2026–27', grants_museum: true, frame_key: null, sort: 1, officers: false, term_ends: null },
    { key: 'officers-2025', name: 'Officers 2025–26', grants_museum: false, frame_key: null, sort: 2, officers: true, term_ends: day(-30) },
  ];
  db.memberAffiliations = [{ member_id: THREE, key: 'officers-2025', position: 'President', seat: 1 }];
  db.museumEntries = [{ project_id: KITE, member_id: ONE }];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('an admin makes a term’s officers’ team and names its officers', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Affiliations' }).click();
  await page.getByRole('button', { name: 'Make it an officers’ team' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Officers 2026–27 is an officers’ team.' })).toBeVisible();
  const team = page.locator('section[aria-labelledby="team-officers-2026"]');
  await team.getByLabel('Term ends (optional)').fill(day(200));
  await team.getByRole('button', { name: /^Save term/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Officers 2026–27’s term is saved.' })).toBeVisible();
  expect(db.affiliations![0]).toMatchObject({ officers: true, term_ends: day(200) });

  const add = team.getByRole('form', { name: 'Add an officer to Officers 2026–27' });
  await add.getByLabel('Member').selectOption({ label: 'Player player-1 (@player-1)' });
  await add.getByLabel('Position').fill('President');
  await add.getByLabel('Order').fill('1');
  await add.getByRole('button', { name: 'Add officer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Player player-1 is now President of Officers 2026–27.' })).toBeVisible();
  await add.getByLabel('Member').selectOption({ label: 'Player player-2 (@player-2)' });
  await add.getByLabel('Position').fill('Vice President');
  await add.getByLabel('Order').fill('2');
  await add.getByRole('button', { name: 'Add officer' }).click();
  await expect(team.getByRole('list', { name: 'Officers of Officers 2026–27' }).getByRole('group')).toHaveCount(2);
  expect(db.memberAffiliations).toEqual(
    expect.arrayContaining([
      { member_id: ONE, key: 'officers-2026', position: 'President', seat: 1 },
      { member_id: TWO, key: 'officers-2026', position: 'Vice President', seat: 2 },
    ]),
  );
  await page.locator('section[aria-labelledby="officer-teams"]').screenshot({ path: 'docs/build/evidence/officers/admin-officers.png' });
});

test('visitors open the Officers door, see pins and positions, and walk into the Officers’ Wing', async ({ page }) => {
  const db = hall();
  db.affiliations![0]!.officers = true;
  db.affiliations![0]!.term_ends = day(200);
  db.memberAffiliations!.push({ member_id: TWO, key: 'officers-2026', position: 'Vice President', seat: 2 }, { member_id: ONE, key: 'officers-2026', position: 'President', seat: 1 });
  await boot(page);
  await mockSupabase(page, { db });
  await page.goto('/');

  // The Officers door: only the current officers, in their seats, and why.
  const door = page.getByRole('button', { name: 'Officers' });
  await door.click();
  await expect(door).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/officers=1/);
  await expect(page.getByRole('status').filter({ hasText: 'players match' })).toHaveText('2 of 3 players match');
  await expect(page.locator('.officers-caption')).toHaveText('The officers of Officers 2026–27, as named by the hall’s admins.');
  await expect(page.locator('.why-picked')).toContainText('President · Officers 2026–27, named by the hall’s admins');
  await page.getByRole('button', { name: /List results/ }).click();
  const list = page.getByRole('list', { name: 'Matching players' });
  await expect(list.getByRole('listitem').nth(0)).toContainText('Player player-1');
  await expect(list.getByRole('listitem').nth(1)).toContainText('Vice President · Officers 2026–27');
  await page.locator('.hall-search').screenshot({ path: 'docs/build/evidence/officers/hall-door.png' });

  // A current officer's badge wears the officer pin; their profile says the seat, a past one says past.
  await page.goto('/member/player-1');
  const profile = page.locator('.profile-screen');
  await expect(profile.getByRole('list', { name: 'Badges' }).first()).toContainText('Officer: President · Officers 2026–27');
  await expect(profile.getByRole('list', { name: 'Affiliations' })).toContainText('Officers 2026–27 · President');
  await expect(profile.locator('.proof-list')).toContainText('Officer: President, Officers 2026–27.');
  await page.goto('/member/player-3');
  await expect(page.locator('.profile-screen').getByRole('list', { name: 'Affiliations' })).toContainText('Officers 2025–26 · President (past)');
  await expect(page.locator('.profile-screen').locator('.proof-list')).toContainText('Past officer: President, Officers 2025–26.');
  await expect(page.locator('.profile-screen').getByRole('list', { name: 'Badges' })).toHaveCount(0);

  // The Museum's Officers' Wing holds the officers' exhibits.
  await page.goto('/museum');
  const doors = page.getByRole('navigation', { name: 'Rooms' });
  await expect(doors.getByRole('link', { name: /Officers' Wing/ })).toContainText('1 exhibit');
  await doors.getByRole('link', { name: /Officers' Wing/ }).click();
  const room = page.getByRole('region', { name: "Officers' Wing" });
  await expect(room).toContainText('Projects by the hall’s current officers, as named by its admins.');
  await expect(room.getByRole('heading', { name: 'Kite' })).toBeVisible();
  await page.screenshot({ path: 'docs/build/evidence/officers/officers-wing.png', fullPage: true });
});
