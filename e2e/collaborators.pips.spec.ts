// Project collaborators (D-089): an owner tags a member of the hall on a project; the tagged member
// accepts or declines in their own editor. Supabase data source, mocked. ("pips" in the name puts it
// in the supabase-data project; it doesn't need PIPs.)
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Ada Lovelace', role: 'member' as const };
const BEE = { id: '00000000-0000-4000-8000-0000000000b2', email: 'bee@example.org', name: 'Bee Hopper', role: 'member' as const };
const P1 = '00000000-0000-4000-8000-00000000f001';

const profile = (id: string, username: string, full_name: string): Row => ({
  id, username, full_name, tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null,
  portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 1,
});

/** Ada (with a saved project) and Bee, both in the hall. */
function hall(): MockDb {
  const db = emptyDb();
  const base = samples[0]!;
  const project = { ...base.card.projects[0]!, id: P1, title: 'Tide Tables' };
  db.profiles.push(profile(ME.id, 'ada', 'Ada Lovelace'), profile(BEE.id, 'bee', 'Bee Hopper'));
  db.projects.push({ ...project, profile_id: ME.id, sort_order: 0, source: 'manual', github_repo_id: null });
  db.published.push(
    { ...base, profile_id: ME.id, username: 'ada', member_no: 1, card: { ...base.card, username: 'ada', full_name: 'Ada Lovelace', projects: [project] } } as Row,
    { ...base, profile_id: BEE.id, username: 'bee', member_no: 2, card: { ...base.card, username: 'bee', full_name: 'Bee Hopper', projects: [] } } as Row,
  );
  return db;
}
const panel = (page: Page) => page.getByRole('region', { name: 'Collaborators' });

test('tag a member on a project; they accept in their own editor', async ({ page, browser }) => {
  const db = hall();
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const tide = panel(page).getByRole('form', { name: 'Tag someone on Tide Tables' });
  await tide.getByLabel('Member’s @username').fill('@bee');
  await tide.getByRole('button', { name: 'Tag' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Asked @bee to join Tide Tables.');
  await expect(panel(page).getByRole('list', { name: 'Collaborators on Tide Tables' })).toContainText('Bee Hopper @bee … waiting');
  expect(db.profiles[0]!.status).toBe('approved'); // tagging never resets review

  const ctx = await browser.newContext();
  const bee = await ctx.newPage();
  await mockSupabase(bee, { user: BEE, db, githubRepos: [] });
  await bee.goto('/edit');
  await expect(panel(bee).getByRole('heading', { name: /Collaborators · 1 new/ })).toBeVisible();
  const req = panel(bee).getByRole('list', { name: 'Projects you were tagged on' });
  await expect(req).toContainText('Tide Tables by Ada Lovelace (@ada)');
  await req.getByRole('button', { name: 'Accept Tide Tables' }).click();
  await expect(panel(bee).getByRole('status')).toHaveText('You’re on Tide Tables. It shows on Ada Lovelace’s card after their next approval.');
  await expect(req).toContainText('✓ accepted');
  await ctx.close();

  await page.reload();
  await expect(panel(page).getByRole('list', { name: 'Collaborators on Tide Tables' })).toContainText('✓ accepted');
});

test('tagging someone not in the hall, or yourself, says why', async ({ page }) => {
  const db = hall();
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const tide = panel(page).getByRole('form', { name: 'Tag someone on Tide Tables' });
  await tide.getByLabel('Member’s @username').fill('nobody-here');
  await tide.getByRole('button', { name: 'Tag' }).click();
  await expect(panel(page).getByRole('status')).toContainText('isn’t in the hall');
  await tide.getByLabel('Member’s @username').fill('ada');
  await tide.getByRole('button', { name: 'Tag' }).click();
  await expect(panel(page).getByRole('status')).toContainText('That’s you');
});

test('a declined member can’t be asked again', async ({ page, browser }) => {
  const db = hall();
  db.collabs = [{ project_id: P1, member_id: BEE.id, status: 'pending' }];
  const ctx = await browser.newContext();
  const bee = await ctx.newPage();
  await mockSupabase(bee, { user: BEE, db, githubRepos: [] });
  await bee.goto('/edit');
  await panel(bee).getByRole('button', { name: 'Decline Tide Tables' }).click();
  await expect(panel(bee).getByRole('status')).toHaveText('Declined Tide Tables. You won’t be asked about it again.');
  await ctx.close();

  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  await expect(panel(page).getByRole('list', { name: 'Collaborators on Tide Tables' })).toContainText('✕ declined');
  const tide = panel(page).getByRole('form', { name: 'Tag someone on Tide Tables' });
  await tide.getByLabel('Member’s @username').fill('bee');
  await tide.getByRole('button', { name: 'Tag' }).click();
  await expect(panel(page).getByRole('status')).toContainText('can’t be asked again');
});
