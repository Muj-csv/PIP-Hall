// Museum console frames (D-091): the maker picks the console an exhibit hangs in, with a live
// preview; visitors see it; automatic is the default. Supabase data source, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
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

test('a maker picks a console for an exhibit; visitors see it; automatic is the default', async ({ page, browser }) => {
  const db = hall();
  grantMuseum(db);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const panel = page.getByRole('region', { name: 'Museum' });
  // No picker until the project is in the Museum.
  await expect(panel.getByLabel('Console for Tide Tables')).toHaveCount(0);
  await panel.getByLabel(/Show Tide Tables in the Museum/).check();
  const pick = panel.getByLabel('Console for Tide Tables');
  await expect(pick).toHaveValue('');
  await expect(pick.locator('option').first()).toHaveText(/^Automatic \((Pocket|Wide|Home TV|Arcade|Flip)\)$/);
  await expect(pick.locator('option')).toHaveCount(6);

  await pick.selectOption('arcade');
  await expect(panel.getByRole('status')).toHaveText('Tide Tables now hangs in a PIXENDO Arcade.');
  await expect(panel.getByRole('img', { name: 'Preview: PIXENDO Arcade' })).toBeVisible();
  expect(db.museumEntries).toEqual([{ project_id: P1, member_id: ME.id, console: 'arcade' }]);
  expect(db.profiles[0]!.status).toBe('approved'); // cosmetic: no review

  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await mockSupabase(visitor, { db });
  await visitor.goto('http://localhost:5174/museum?view=list');
  await expect(exhibits(visitor).first().locator('.exhibit-frame')).toHaveAttribute('data-console', 'arcade');
  await exhibits(visitor).first().getByRole('link', { name: 'Tide Tables' }).click();
  await expect(visitor.getByText('On show on a PIXENDO Arcade')).toBeVisible();
  await expect(visitor.locator('.exhibit-frame')).toHaveAttribute('data-on', 'true'); // booted once seen
  await ctx.close();

  await pick.selectOption('');
  await expect(panel.getByRole('status')).toHaveText('Tide Tables now hangs in a console picked for it.');
  expect(db.museumEntries![0]!.console).toBeNull();
});

test('the automatic console is the same on every visit', async ({ page }) => {
  const db = hall();
  grantMuseum(db);
  db.museumEntries = [{ project_id: P1, member_id: ME.id }, { project_id: P2, member_id: ME.id }];
  await mockSupabase(page, { db });
  await page.goto('/museum?view=list');
  const frames = page.locator('.exhibit-frame');
  await expect(frames).toHaveCount(2);
  const first = await frames.evaluateAll((els) => els.map((e) => e.getAttribute('data-console')).sort());
  await page.reload();
  await expect(frames).toHaveCount(2);
  expect(await frames.evaluateAll((els) => els.map((e) => e.getAttribute('data-console')).sort())).toEqual(first);
});
