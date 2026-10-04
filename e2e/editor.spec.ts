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

  // Photo: cropped and resized in the browser, previewed on the badge before upload.
  await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.getByRole('button', { name: 'Use this photo' }).click();
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

test('phone photos: the picker offers gallery and camera, and files with no type still work', async ({ page }) => {
  await mockSupabase(page, { user: USER, db: emptyDb('octocat'), githubRepos: REPOS });
  await page.goto('/edit');
  const input = page.locator('input[type=file]');
  await expect(input).toHaveAttribute('accept', 'image/*');
  await expect(input).not.toHaveAttribute('capture');

  // Some Android galleries hand over files with an empty type.
  await input.setInputFiles({ name: 'IMG_2041.jpg', mimeType: '', buffer: TINY_PNG });
  await page.getByRole('button', { name: 'Use this photo' }).click();
  await expect(page.locator('.preview-stage img.photo')).toHaveAttribute('src', /^blob:/);

  // A HEIC this browser can't open gets a clear way out.
  await input.setInputFiles({ name: 'IMG_2042.HEIC', mimeType: 'image/heic', buffer: Buffer.from('not really an image') });
  await expect(page.getByRole('alert')).toContainText('can’t open HEIC photos');
});

test('Safari can’t save WebP: the photo is saved as JPEG instead', async ({ page }) => {
  // Like Safari: asked for WebP, the canvas hands back PNG.
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
      return toBlob.call(this, cb, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  const db = emptyDb('octocat');
  await mockSupabase(page, { user: USER, db, githubRepos: REPOS });
  const upload = page.waitForRequest((r) => r.url().includes('/storage/v1/object/avatars/') && r.method() === 'POST');
  await page.goto('/edit');
  await page.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.getByRole('button', { name: 'Use this photo' }).click();
  await expect(page.locator('.preview-stage img.photo')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save and submit for review' }).first().click();
  await expect(page.locator('.status-tag')).toHaveText('PENDING REVIEW');
  const req = await upload;
  expect(req.url()).toMatch(/\.jpg$/);
  expect(req.postDataBuffer()?.toString('latin1')).toContain('image/jpeg');
  expect(db.profiles[0]!.avatar_path).toMatch(/\.jpg$/);
});

test('the member crops the photo: drag, keyboard and zoom pick what shows on the badge', async ({ page }) => {
  await mockSupabase(page, { user: USER, db: emptyDb('octocat'), githubRepos: REPOS });
  await page.goto('/edit');

  // A 400 × 300 photo: left half red, right half blue.
  const photo = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgb(255,0,0)';
    ctx.fillRect(0, 0, 200, 300);
    ctx.fillStyle = 'rgb(0,0,255)';
    ctx.fillRect(200, 0, 200, 300);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const pick = async () => {
    await page.locator('input[type=file]').setInputFiles({ name: 'split.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
    await expect(page.getByRole('application', { name: /Photo crop/ })).toBeFocused();
    await page.getByLabel('Zoom', { exact: true }).fill('2');
  };
  const preview = page.locator('.preview-stage img.photo');
  const use = async () => {
    const before = (await preview.count()) ? await preview.getAttribute('src') : null;
    await page.getByRole('button', { name: 'Use this photo' }).click();
    if (before) await expect(preview).not.toHaveAttribute('src', before);
  };
  // Size of the saved photo and the colour in its middle.
  const saved = () =>
    page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>('.preview-stage img.photo')!;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const [r, , b] = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
      return { width: c.width, height: c.height, colour: r! > b! ? 'red' : 'blue' };
    });

  // Drag the photo left: the box moves right, onto the blue half.
  await pick();
  const box = (await page.locator('.crop-frame').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await use();
  // Zoom 2 on a 400px-wide photo: a 200px-wide crop in the badge's 178:82 shape.
  expect(await saved()).toEqual({ width: 200, height: 92, colour: 'blue' });

  // Keyboard: back to the crop area (Shift+Tab from the slider), arrow left to the red half.
  await pick();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('application', { name: /Photo crop/ })).toBeFocused();
  for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowLeft');
  await use();
  expect(await saved()).toMatchObject({ colour: 'red' });

  // Cancel keeps the photo that was there.
  await page.locator('input[type=file]').setInputFiles({ name: 'split.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await saved()).toMatchObject({ colour: 'red' });
});

test('Save and Submit appear once at any width: beside the badge on desktop, pinned at the bottom on phones', async ({ page }) => {
  await mockSupabase(page, { user: USER, db: emptyDb('octocat'), githubRepos: REPOS });
  await page.goto('/edit');
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toHaveCount(1);
  await expect(page.locator('.editor-actions[data-at="side"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(save).toHaveCount(1);
  await expect(page.locator('.editor-actions[data-at="bottom"]')).toBeVisible();
  await expect(page.locator('.editor-actions[data-at="side"]')).toBeHidden();
});

test('reordering saved GitHub projects on an approved card saves (only updatable columns are sent)', async ({ page }) => {
  const db = emptyDb('octocat');
  db.profiles.push({ id: USER.id, username: 'octocat', full_name: 'Test Member', tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: 'octocat', linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: [], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 1 });
  db.published.push({ profile_id: USER.id, username: 'octocat', card: {}, member_no: 1 });
  for (const [i, r] of [REPOS[0]!, REPOS[1]!].entries()) {
    db.projects.push({ id: `p${i}`, profile_id: USER.id, source: 'github', github_repo_id: r.id, title: r.name, description: r.description, cover_path: null, project_url: null, github_url: r.html_url, language: r.language, stars: r.stargazers_count, tech_stack: [], project_date: null, sort_order: i });
  }
  const log = await mockSupabase(page, { user: USER, db, githubRepos: REPOS });
  await page.goto('/edit');
  await page.getByRole('button', { name: 'Move spoon-knife up' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Saved/ }).first()).toBeVisible();
  await expect(page.getByText('permission denied')).toHaveCount(0);
  expect(db.projects.find((r) => r.id === 'p1')?.sort_order).toBe(0);
  expect(log.requests.filter((r) => r.startsWith('PATCH /rest/v1/projects'))).toHaveLength(2);
});
