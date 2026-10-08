// App previews on the console screens (D-092): the uploaded screenshot, else GitHub's preview of
// the repo, else the pixel cover; a picture that fails to load falls back to the pixel cover.
// Supabase data source and GitHub's image host are mocked: no network.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, TINY_PNG, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

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

const OG = 'https://opengraph.githubassets.com/**';
const png = { status: 200, contentType: 'image/png', body: TINY_PNG };

/** Ada's two projects hang in the Museum; P1 links a public GitHub repo. */
function museum(): MockDb {
  const db = hall();
  grantMuseum(db);
  const card = db.published[0]!.card as Row;
  card.projects = (card.projects as Row[]).map((p) => (p.id === P1 ? { ...p, github_url: 'https://github.com/ada/tide-tables' } : { ...p, github_url: null }));
  db.museumEntries = [{ project_id: P1, member_id: ME.id }, { project_id: P2, member_id: ME.id }];
  return db;
}
const stage = (page: Page, title: string) => exhibits(page).filter({ hasText: title }).locator('.exhibit-stage');

test('a linked repo shows GitHub’s preview on the screen; a project without one shows the pixel cover', async ({ page }) => {
  const asked: string[] = [];
  await mockSupabase(page, { db: museum() });
  await page.route(OG, (r) => (asked.push(r.request().url()), r.fulfill(png)));
  await page.goto('/museum?view=list');
  await expect(stage(page, 'Tide Tables')).toHaveAttribute('data-preview', 'github');
  await expect(stage(page, 'Tide Tables').locator('img')).toHaveAttribute('src', 'https://opengraph.githubassets.com/1/ada/tide-tables');
  await expect.poll(() => asked).toContain('https://opengraph.githubassets.com/1/ada/tide-tables');
  await expect(stage(page, 'Pixel Diary')).toHaveAttribute('data-preview', 'pixel');
  await expect(stage(page, 'Pixel Diary').locator('canvas')).toHaveCount(4);
});

test('when GitHub’s preview fails to load, the screen falls back to the pixel cover', async ({ page }) => {
  await mockSupabase(page, { db: museum() });
  await page.route(OG, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/museum?view=list');
  await expect(stage(page, 'Tide Tables')).toHaveAttribute('data-preview', 'pixel');
  await expect(stage(page, 'Tide Tables').locator('canvas')).toHaveCount(4);
});

test('a member uploads a screenshot; after approval it shows on the console instead of GitHub’s preview', async ({ page, browser }) => {
  const db = museum();
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const list = page.getByRole('list', { name: 'Projects on your card' });
  await expect(list.getByText(/Upload a screenshot to show your app on the console screen/).first()).toBeVisible();
  await list.getByLabel('Upload a screenshot for Tide Tables').setInputFiles({ name: 'app.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(list.getByRole('img', { name: 'Screen picture for Tide Tables' })).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Saved' }).first()).toBeVisible();

  const saved = db.projects.find((p) => p.id === P1)!;
  expect(saved.cover_path).toMatch(new RegExp(`^${ME.id}/[0-9a-f-]{36}\\.(webp|jpg)$`));
  expect(db.coverUploads).toEqual([saved.cover_path]);
  expect(db.projects.find((p) => p.id === P2)!.cover_path).toBeNull();
  expect(db.profiles[0]!.status).toBe('draft'); // goes public with the next approval, like every card change

  // Approved (the snapshot now carries the picture): visitors see it on the screen.
  const card = db.published[0]!.card as Row;
  card.projects = (card.projects as Row[]).map((p) => (p.id === P1 ? { ...p, cover_path: saved.cover_path } : p));
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await mockSupabase(visitor, { db });
  await visitor.route('**/storage/v1/object/public/project-covers/**', (r) => r.fulfill(png));
  await visitor.route(OG, (r) => r.fulfill(png));
  await visitor.goto('http://localhost:5174/museum?view=list');
  await expect(stage(visitor, 'Tide Tables')).toHaveAttribute('data-preview', 'upload');
  await expect(stage(visitor, 'Tide Tables').locator('img')).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/project-covers/${saved.cover_path}$`));
  await ctx.close();

  // Removing the picture is a normal card edit.
  await list.getByRole('button', { name: 'Remove screen picture for Tide Tables' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Saved' }).first()).toBeVisible();
  expect(db.projects.find((p) => p.id === P1)!.cover_path).toBeNull();
});
