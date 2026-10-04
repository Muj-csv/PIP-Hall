// Phase 3 acceptance (docs/build/PHASE-3.md): a member builds and submits their card without help.
// Supabase and the GitHub API are mocked (e2e/mockSupabase.ts, e2e/mockDb.ts).
import { expect, test, type Page } from '@playwright/test';
import { emptyDb, TINY_PNG } from './mockDb';
import { mockSupabase } from './mockSupabase';

const USER = { id: '00000000-0000-4000-8000-0000000000a1', email: 'member@example.org', name: 'Test Member', github: 'octocat', role: 'member' as const };

const repo = (id: number, name: string, language: string, stars: number) => ({
  id,
  name,
  description: `${name} description`,
  language,
  stargazers_count: stars,
  pushed_at: '2026-09-30T10:00:00Z',
  updated_at: '2026-09-30T10:00:00Z',
  html_url: `https://github.com/octocat/${name}`,
  homepage: name === 'hello-world' ? 'https://octocat.github.io/hello-world' : '',
  fork: false,
  archived: false,
});
const REPOS = [repo(1, 'hello-world', 'TypeScript', 42), repo(2, 'spoon-knife', 'HTML', 12), repo(3, 'linguist', 'Ruby', 7), repo(4, 'octo-site', 'CSS', 1)];

const projects = (page: Page) => page.getByRole('region', { name: 'Projects' });

test.skip(({ isMobile }) => isMobile, 'editor flows run on desktop; layout is covered by screenshots');

test('full path: pick 3 repos, add a manual project, add a photo, submit → pending', async ({ page }) => {
  const db = emptyDb('octocat');
  const log = await mockSupabase(page, { user: USER, db, githubRepos: REPOS });
  await page.goto('/edit');

  // New card: prefilled from Google and GitHub.
  await expect(page.locator('.status-tag')).toHaveText('NEW CARD');
  await expect(page.getByLabel('Username')).toHaveValue('octocat');
  await expect(page.getByLabel('Name on the badge')).toHaveValue('Test Member');

  await page.getByLabel('Role').fill('Frontend dev · design systems');
  await page.getByLabel('Bio').fill('Builds playful tools for people.');
  const skills = page.getByRole('textbox', { name: /^Skills/ });
  await skills.fill('TypeScript');
  await skills.press('Enter');

  // Pick three repos.
  for (const name of ['hello-world', 'spoon-knife', 'linguist']) await projects(page).getByRole('checkbox', { name: new RegExp(name) }).check();
  await expect(page.getByRole('list', { name: 'Projects on your card' }).getByRole('listitem')).toHaveCount(3);

  // One manual project.
  await page.getByRole('button', { name: '+ Add a project by hand' }).click();
  const manual = page.locator('.manual-form');
  await manual.getByLabel('Title').fill('Devpost Quest');
  await manual.getByLabel('What is it?').fill('A hackathon build.');
  await manual.getByLabel('Link (optional)').fill('https://devpost.com/software/quest');
  await manual.getByRole('button', { name: 'Add project' }).click();
  await expect(page.getByRole('list', { name: 'Projects on your card' }).getByRole('listitem')).toHaveCount(4);

  // Photo: resized in the browser, previewed on the badge before upload.
  await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.locator('.preview-stage img.photo')).toHaveAttribute('src', /^blob:/);

  // The live badge follows the form.
  await expect(page.locator('.preview-stage .badge-name').first()).toHaveText('Test Member');
  await expect(page.locator('.preview-stage .stat').first()).toContainText('4');

  await page.getByRole('button', { name: 'Save and submit for review' }).first().click();
  await expect(page.locator('.status-tag')).toHaveText('PENDING REVIEW');

  // What reached "the database".
  const profile = db.profiles[0]!;
  expect(profile).toMatchObject({ username: 'octocat', full_name: 'Test Member', status: 'pending_review', github_username: 'octocat', skills: ['TypeScript'] });
  expect(profile.avatar_path).toMatch(new RegExp(`^${USER.id}/[0-9a-f-]{36}\\.webp$`));
  expect(db.uploads).toEqual([profile.avatar_path]);
  expect(db.projects.map((p) => [p.title, p.source, p.sort_order])).toEqual([
    ['hello-world', 'github', 0],
    ['spoon-knife', 'github', 1],
    ['linguist', 'github', 2],
    ['Devpost Quest', 'manual', 3],
  ]);
  expect(db.projects[0]).toMatchObject({ github_repo_id: 1, github_url: 'https://github.com/octocat/hello-world', project_url: 'https://octocat.github.io/hello-world', language: 'TypeScript', stars: 42 });
  expect(log.requests).toContain('POST /rest/v1/rpc/sync_github_identity');
  expect(log.requests).toContain('POST /rest/v1/rpc/submit_for_review');
});

test('editing an approved card says the live version is older; the public card is unchanged', async ({ page }) => {
  const db = emptyDb('octocat');
  db.profiles.push({ id: USER.id, username: 'octocat', full_name: 'Test Member', tagline: null, bio: 'Old bio', role: null, org_position: null, department: null, avatar_path: null, github_username: 'octocat', linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 3 });
  db.published.push({ profile_id: USER.id, username: 'octocat', card: { bio: 'Old bio' }, member_no: 3 });
  await mockSupabase(page, { user: USER, db, githubRepos: REPOS });
  await page.goto('/edit');

  await expect(page.locator('.status-tag')).toHaveText('APPROVED');
  await expect(page.locator('[data-field="username"]')).toContainText('@octocat'); // locked, shown read-only
  await expect(page.getByLabel('Username')).toHaveCount(0);
  await expect(page.locator('.preview-stage .band-no').first()).toHaveText('No.003');

  await page.getByLabel('Bio').fill('New bio');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.locator('.status-tag')).toHaveText('EDITING');
  await expect(page.locator('.editor-side .dialogue .sr-only')).toContainText('Live version is older — submit changes');
  await expect(page.getByRole('button', { name: 'Submit changes' }).first()).toBeVisible();
  expect(db.profiles[0]!.status).toBe('draft');
  expect(db.published[0]!.card).toEqual({ bio: 'Old bio' }); // only an admin's approval replaces it
});

test('invalid fields show errors under them and focus moves to the first one', async ({ page }) => {
  await mockSupabase(page, { user: USER, githubRepos: [] });
  await page.goto('/edit');
  await page.getByLabel('Name on the badge').fill('');
  await page.getByLabel('LinkedIn').fill('http://linkedin.com/in/x');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByLabel('Name on the badge')).toBeFocused();
  await expect(page.getByLabel('Name on the badge')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Your name goes on the badge.')).toBeVisible();
  await expect(page.getByText('Use your LinkedIn link, like https://www.linkedin.com/in/you.')).toBeVisible();
});

test('a rate-limited GitHub says when it resets, and manual projects still work', async ({ page }) => {
  await mockSupabase(page, { user: USER, githubRepos: { rateLimitedUntil: new Date(Date.now() + 30 * 60 * 1000) } });
  await page.goto('/edit');
  await expect(projects(page).getByRole('alert')).toContainText('hourly limit');
  await expect(projects(page).getByRole('alert')).toContainText('It resets at');
  await page.getByRole('button', { name: '+ Add a project by hand' }).click();
  await page.locator('.manual-form').getByLabel('Title').fill('Offline Quest');
  await page.locator('.manual-form').getByRole('button', { name: 'Add project' }).click();
  await expect(page.getByRole('list', { name: 'Projects on your card' })).toContainText('Offline Quest');
});

test('a member without public repos is pointed to the manual form', async ({ page }) => {
  await mockSupabase(page, { user: USER, githubRepos: [] });
  await page.goto('/edit');
  await expect(projects(page)).toContainText('No public repos yet');
});

test('Ctrl/Cmd+S saves, and leaving with unsaved changes asks first', async ({ page }) => {
  const db = emptyDb('octocat');
  await mockSupabase(page, { user: USER, db, githubRepos: [] });
  await page.goto('/edit');
  await page.getByLabel('Role').fill('Designer');
  await page.locator('header a').first().click();
  await expect(page.getByRole('alertdialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay and keep editing' }).click();
  await expect(page).toHaveURL(/\/edit$/);

  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.status-tag')).toHaveText('DRAFT');
  expect(db.profiles[0]).toMatchObject({ role: 'Designer', status: 'draft' });
  await page.locator('header a').first().click();
  await expect(page).toHaveURL('http://localhost:5173/'); // saved, so no prompt
});

test('a full card of 6 can swap a project (removals are saved first)', async ({ page }) => {
  const db = emptyDb('octocat');
  db.profiles.push({ id: USER.id, username: 'octocat', full_name: 'Test Member', tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: 'octocat', linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'draft', review_note: null, is_featured: false, username_locked: false, member_no: null });
  for (let i = 0; i < 6; i++) db.projects.push({ id: `p${i}`, profile_id: USER.id, source: 'manual', github_repo_id: null, title: `Quest ${i}`, description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], project_date: null, sort_order: i });
  await mockSupabase(page, { user: USER, db, githubRepos: REPOS });
  await page.goto('/edit');
  await expect(projects(page).getByRole('checkbox', { name: /hello-world/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Remove Quest 0' }).click();
  await projects(page).getByRole('checkbox', { name: /hello-world/ }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Saved' }).first()).toBeVisible();
  expect(db.projects.map((p) => p.title)).toEqual(['Quest 1', 'Quest 2', 'Quest 3', 'Quest 4', 'Quest 5', 'hello-world']);
});
