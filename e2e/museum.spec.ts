// MUSEUM and affiliations (docs/plan/MUSEUM.md, D-067…D-069). Supabase data source, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Ada Lovelace', role: 'member' as const };
const P1 = '00000000-0000-4000-8000-00000000f001';
const P2 = '00000000-0000-4000-8000-00000000f002';

/** Me in the hall with two approved projects (ids in the snapshot, D-069). */
function hall(): MockDb {
  const db = emptyDb();
  const base = samples[0]!;
  const projects = [
    { ...base.card.projects[0]!, id: P1, title: 'Tide Tables', description: 'Ocean data for surfers' },
    { ...base.card.projects[1]!, id: P2, title: 'Pixel Diary' },
  ];
  db.profiles.push({ id: ME.id, username: 'ada', full_name: 'Ada Lovelace', tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 1 });
  for (const [i, p] of projects.entries()) db.projects.push({ ...p, profile_id: ME.id, sort_order: i, source: 'manual', github_repo_id: null });
  db.published.push({ ...base, profile_id: ME.id, username: 'ada', member_no: 1, card: { ...base.card, username: 'ada', full_name: 'Ada Lovelace', projects } } as Row);
  return db;
}

const grantMuseum = (db: MockDb) => {
  db.affiliations = [{ key: 'cs-student', name: 'CS Student', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [{ member_id: ME.id, key: 'cs-student' }];
};
const exhibits = (page: Page) => page.getByRole('list', { name: 'Exhibits' }).locator(':scope > li');

test('admin creates an affiliation that gives Museum access and gives it to a member', async ({ page }) => {
  const db = hall();
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Affiliations' }).click();
  await expect(page.locator('.dialogue .sr-only')).toContainText('No affiliations yet');
  await page.getByLabel('Name').fill('CS Student');
  await page.getByLabel('Gives Museum access').check();
  await page.getByRole('button', { name: 'Add affiliation' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Added CS Student.');
  expect(db.affiliations).toMatchObject([{ key: 'cs-student', name: 'CS Student', grants_museum: true }]);

  await page.getByRole('tab', { name: /Published/ }).click();
  await page.getByRole('group', { name: 'Affiliations' }).getByLabel(/CS Student/).check();
  await expect(page.locator('main > .notice')).toHaveText('Ada Lovelace is now CS Student.');
  expect(db.memberAffiliations).toEqual([{ member_id: ME.id, key: 'cs-student' }]);
});

test('a member cannot reach affiliation tools', async ({ page }) => {
  const db = hall();
  await mockSupabase(page, { user: ME, db });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admins only' })).toBeVisible();
});

test('a member with Museum access puts a project in; visitors see it as approved and meet its maker', async ({ page, browser }) => {
  const db = hall();
  grantMuseum(db);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const panel = page.getByRole('region', { name: 'Museum' });
  await panel.getByLabel(/Show Tide Tables in the Museum/).check();
  await expect(panel.getByRole('status')).toHaveText('Tide Tables is in the Museum.');
  expect(db.museumEntries).toEqual([{ project_id: P1, member_id: ME.id }]);
  expect(db.profiles[0]!.status).toBe('approved'); // no review needed

  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await mockSupabase(visitor, { db });
  await visitor.goto('http://localhost:5174/museum?view=list');
  await expect(exhibits(visitor)).toHaveCount(1);
  await expect(exhibits(visitor).first()).toContainText('Tide Tables');
  await expect(exhibits(visitor).first()).toContainText('Ocean data for surfers');
  await visitor.getByRole('link', { name: 'Ada Lovelace' }).click();
  await expect(visitor).toHaveURL(/\/member\/ada$/);
  await expect(visitor.locator('.profile-screen').getByRole('list', { name: 'Affiliations' })).toHaveText(/CS Student/);
  await ctx.close();
});

test('without Museum access the editor has no Museum panel', async ({ page }) => {
  const db = hall();
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  await expect(page.getByRole('region', { name: 'Who you are' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Museum' })).toHaveCount(0);
});

test('losing access takes exhibits down; an empty Museum says so', async ({ page }) => {
  const db = hall();
  grantMuseum(db);
  db.museumEntries = [{ project_id: P1, member_id: ME.id }];
  db.memberAffiliations = [];
  await mockSupabase(page, { db });
  await page.goto('/museum');
  await expect(page.locator('.dialogue .sr-only')).toContainText('waiting for its first exhibit');
});

test('the panel lists the approved card: a project removed from the draft stays in the Museum until re-approval', async ({ page }) => {
  const db = hall();
  grantMuseum(db);
  db.museumEntries = [{ project_id: P2, member_id: ME.id }];
  db.projects = db.projects.filter((p) => p.id !== P2); // edited out of the draft, not yet re-approved
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const panel = page.getByRole('region', { name: 'Museum' });
  await expect(panel.getByLabel(/Show Pixel Diary in the Museum/)).toBeChecked();
  await expect(panel.getByLabel(/Show Tide Tables in the Museum/)).not.toBeChecked();

  await page.goto('/museum?view=list');
  await expect(exhibits(page)).toHaveCount(1);
  await expect(exhibits(page).first()).toContainText('Pixel Diary');
});

test('admin sees who has Museum access and how many exhibits they show', async ({ page }) => {
  const db = hall();
  grantMuseum(db);
  db.museumEntries = [{ project_id: P1, member_id: ME.id }];
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Affiliations' }).click();
  const summary = page.getByRole('region', { name: 'Museum' });
  await expect(summary.getByRole('status')).toHaveText('1 member has Museum access · 1 exhibit on show');
  await expect(summary.getByRole('row', { name: /Ada Lovelace/ })).toContainText('2');
});
