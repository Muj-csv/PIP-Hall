// V2-21 (D-134): My Card, made clear. Tabs beside the live badge, a three-step guide for a first card,
// Customize (frame, title, plate: wearing here, buying in the PIP MART) and the folded badge on
// phones. Supabase data source, mocked, PIPs on. Editing itself is covered by editor.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const EVIDENCE = 'docs/build/evidence/my-card';

function profile(status: 'draft' | 'approved'): Row {
  return {
    id: ME.id,
    username: 'me-player',
    full_name: 'Test Member',
    tagline: null,
    bio: 'Builds pixel things.',
    role: 'Frontend dev',
    org_position: null,
    department: null,
    avatar_path: null,
    github_username: null,
    linkedin_url: null,
    portfolio_url: null,
    public_email: null,
    show_email: false,
    email_updates: false,
    skills: ['TypeScript'],
    status,
    review_note: null,
    is_featured: false,
    username_locked: status === 'approved',
    member_no: status === 'approved' ? 1 : null,
  };
}

/** Me with an approved card in the hall: a frame and a plate bought, a title earned, a perk frame from an affiliation. */
function approved(): MockDb {
  const db = emptyDb();
  db.identity = true;
  db.profiles.push(profile('approved'));
  const base = samples[0]!;
  db.published.push({ ...base, profile_id: ME.id, username: 'me-player', member_no: 1, is_featured: false, card: { ...base.card, username: 'me-player', full_name: 'Test Member', is_featured: false } });
  db.projects.push({ id: 'p1', profile_id: ME.id, source: 'manual', github_repo_id: null, title: 'Pixel Quest', description: null, cover_path: null, project_url: null, github_url: null, language: null, stars: null, tech_stack: [], project_date: null, sort_order: 0 });
  db.earned = { [ME.id]: ['pioneer'] };
  db.inventory = [
    { member_id: ME.id, item_key: 'meadow' },
    { member_id: ME.id, item_key: 'plate-brass' },
  ];
  db.affiliations = [{ key: 'code-guild', name: 'Code Guild', grants_museum: false, frame_key: 'member', sort: 1 }];
  db.memberAffiliations = [{ member_id: ME.id, key: 'code-guild' }];
  db.ledger = [{ id: 1, member_id: ME.id, amount: 120, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  return db;
}

const boot = async (page: Page) => {
  // Still pictures for the evidence: no typing or opening animations caught halfway.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
};
/** The badge column is sticky: shoot from the top of the page so it sits where a visitor sees it. */
const shoot = async (page: Page, name: string, fullPage = false) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage });
};
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const badge = (page: Page) => page.locator('.editor-side .preview-stage .badge');
const row = (page: Page, name: string) => page.locator('.mart-row').filter({ has: page.getByText(name, { exact: true }) });

test('Customize gathers what you wear: a frame, a title and a plate; the badge shows them, and the Mart links here', async ({ page }) => {
  const db = approved();
  await boot(page);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/mart');
  await page.getByRole('link', { name: 'Wear it in My Card' }).click();
  await expect(page).toHaveURL(/\/edit\?tab=customize$/);
  await expect(tab(page, 'Customize')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Make your card' })).toHaveCount(0); // the guide is for a first card

  // Frames: the plain badge, what you own and your affiliation's perk frame. Nothing is sold here.
  const frames = page.getByRole('region', { name: 'Frame' });
  await expect(frames.locator('.mart-row')).toHaveCount(3);
  await expect(row(page, 'Plain badge')).toContainText('✓ Wearing');
  await expect(frames.getByRole('button', { name: /Buy/ })).toHaveCount(0);
  await expect(frames.getByRole('link', { name: 'Get frames in the PIP MART' })).toHaveAttribute('href', '/mart');
  await row(page, 'Meadow Frame').getByRole('button', { name: 'Wear Meadow Frame' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Wearing the Meadow Frame.' })).toBeVisible();
  await expect(row(page, 'Meadow Frame')).toContainText('✓ Wearing');
  await expect(badge(page)).toHaveAttribute('data-frame', 'meadow');

  // Titles: only the earned ones, worn on the plate you own.
  const titles = page.getByRole('region', { name: 'Title', exact: true });
  await expect(titles.locator('.mart-row')).toHaveCount(3); // No title, Card Holder, Pioneer
  await expect(titles).not.toContainText('Curator');
  await row(page, 'Pioneer').getByRole('button', { name: 'Wear Pioneer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your badge now says Pioneer.' })).toBeVisible();
  await expect(badge(page).locator('.badge-title').first()).toHaveText('Title: Pioneer');
  await row(page, 'Brass Plate').getByRole('button', { name: 'Wear Brass Plate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Your title is on the Brass Plate now.' })).toBeVisible();
  await expect(badge(page).locator('.badge-title').first()).toHaveAttribute('data-plate', 'bought');
  expect(db.appearance?.find((a) => a.member_id === ME.id)).toMatchObject({ frame: 'meadow', title: 'pioneer', plate: 'plate-brass' });
  await shoot(page, 'customize-desktop');

  // The perk frame is free with the affiliation.
  await row(page, 'CODE GUILD MEMBER frame').getByRole('button', { name: /Wear/ }).click();
  await expect(badge(page)).toHaveAttribute('data-frame', 'member');
  await expect(badge(page).locator('.badge-face[data-side="front"] .holder-print')).toHaveText('CODE GUILD MEMBER');
});

test('a first card: the guide and the Info tab beside the live badge; Customize opens once approved', async ({ page }) => {
  const db = emptyDb();
  db.identity = true;
  await boot(page);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  await expect(page.locator('.status-tag')).toHaveText('NEW CARD');
  await expect(page.getByRole('region', { name: 'Make your card' })).toContainText('three steps');
  await page.getByLabel('Role').fill('Frontend dev');
  await page.getByLabel('Bio').fill('Builds pixel things.');
  await expect(tab(page, 'Info')).toHaveAccessibleName('Info (done)');
  await expect(page.locator('.editor-side .preview-stage .badge-name').first()).toHaveText('Test Member');
  await shoot(page, 'first-card-desktop', true);

  await tab(page, 'Customize').click();
  await expect(page.getByRole('tabpanel', { name: /^Customize/ })).toContainText('Customize opens once your card is approved.');
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /rpc\/my_mart/.test(r.name)))).toBe(false); // nothing asked before approval
});

test('phones: the badge folds into a small preview, the tabs scroll sideways, Save and Submit stay at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const db = approved();
  db.profiles[0]!.status = 'draft'; // an edited, approved card: Submit changes
  await boot(page);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit');
  const mini = page.locator('.badge-mini');
  await expect(mini).toBeVisible();
  await expect(mini.locator('.badge')).toBeVisible();
  expect((await mini.locator('.badge').boundingBox())!.width).toBeLessThanOrEqual(112);
  await expect(page.locator('.status-tag')).toHaveText('EDITING');
  await expect(page.getByRole('button', { name: 'Submit changes' })).toBeVisible();
  await expect(page.locator('.editor-actions[data-at="bottom"]')).toBeVisible();

  // The tabs stay on one row and scroll sideways; the page itself never does.
  const list = page.getByRole('tablist', { name: 'My card' });
  const rows = new Set(await list.getByRole('tab').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
  expect(rows.size).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await tab(page, 'Account').click();
  await expect(tab(page, 'Account')).toBeInViewport();
  await tab(page, 'Info').click();
  await shoot(page, 'phone-folded');

  // Tap for the big one, flip it, fold it away again.
  await page.getByRole('button', { name: 'Show my badge' }).click();
  await expect(page.locator('.editor-side .preview-stage .badge')).toBeVisible();
  await page.getByRole('button', { name: 'Show Quest Log' }).click();
  await expect(page.locator('.editor-side .preview-stage .badge')).toHaveAttribute('data-flipped', 'true');
  await shoot(page, 'phone-open');
  await page.getByRole('button', { name: 'Fold my badge' }).click();
  await expect(mini).toBeVisible();
});
