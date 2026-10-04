// Phase 4 acceptance (docs/build/PHASE-4.md): the moderation queue. Runs against the Supabase
// data source (port 5174), so an approved card really shows up in the hall from published_cards.
import { expect, test, type Page } from '@playwright/test';
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const MEMBER = { id: '00000000-0000-4000-8000-0000000000a1', email: 'member@example.org', name: 'Test Member', role: 'member' as const };
const NEW_ID = '00000000-0000-4000-8000-0000000000c1';
const LIVE_ID = '00000000-0000-4000-8000-0000000000c2';

const profile = (id: string, over: Row): Row => ({
  id,
  full_name: 'Someone',
  tagline: null,
  bio: null,
  role: null,
  org_position: null,
  department: null,
  avatar_path: null,
  github_username: null,
  linkedin_url: null,
  portfolio_url: null,
  public_email: null,
  show_email: false,
  email_updates: false,
  skills: [],
  status: 'pending_review',
  review_note: null,
  is_featured: false,
  username_locked: false,
  member_no: null,
  submitted_at: '2026-10-05T09:00:00Z',
  ...over,
});

/** One brand-new card waiting, one live card whose owner submitted changes. */
function seed(): MockDb {
  const db = emptyDb();
  db.profiles.push(
    profile(NEW_ID, { username: 'nova', full_name: 'Nova Reyes', bio: 'Draws pixel maps.', skills: ['Figma'] }),
    profile(LIVE_ID, { username: 'kai', full_name: 'Kai Santos', bio: 'New bio, waiting.', status: 'pending_review', username_locked: true, member_no: 1 }),
  );
  db.projects.push({ id: crypto.randomUUID(), profile_id: NEW_ID, source: 'manual', github_repo_id: null, title: 'Map Maker', description: 'Tile editor', tech_stack: [], sort_order: 0 });
  db.published.push({
    profile_id: LIVE_ID,
    username: 'kai',
    is_featured: false,
    published_at: '2026-10-04T09:00:00Z',
    member_no: 1,
    card: { username: 'kai', full_name: 'Kai Santos', tagline: null, bio: 'Old bio.', role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, skills: [], theme: 'classic', is_featured: false, projects: [] },
  });
  return db;
}

async function openAdmin(page: Page, db: MockDb) {
  const log = await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: 'Pending (2)' })).toHaveAttribute('aria-selected', 'true');
  return log;
}


test('approve: the draft is shown beside the live card, and approving puts it in the hall', async ({ page }) => {
  const db = seed();
  const log = await openAdmin(page, db);

  // The oldest submission is open first. New card: one badge.
  const panel = page.getByRole('region', { name: /Reviewing Nova Reyes/ });
  await expect(panel.locator('figcaption')).toHaveText(['SUBMITTED · FRONT']);
  await expect(panel).toContainText('New card: approving gives it the next member number.');

  // An update to a live card shows both.
  await page.getByRole('button', { name: /Kai Santos/ }).click();
  const kai = page.getByRole('region', { name: /Reviewing Kai Santos/ });
  await expect(kai.locator('figcaption')).toHaveText(['SUBMITTED · FRONT', 'LIVE NOW · FRONT']);

  // Approve Nova.
  await page.getByRole('button', { name: /Nova Reyes/ }).click();
  await page.getByRole('button', { name: 'Approve card' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Approved Nova Reyes. Their card is in the hall.');
  await expect(page.getByRole('tab', { name: 'Pending (1)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Published (2)' })).toBeVisible();
  expect(log.requests).toContain('POST /rest/v1/rpc/approve_profile');
  expect(db.published.find((r) => r.profile_id === NEW_ID)?.member_no).toBe(2);

  // …and it hangs in the hall, read from published_cards.
  await page.addInitScript(() => sessionStorage.setItem('piphall-booted', '1'));
  await page.goto('/');
  await expect(page.locator('.hud span').last()).toHaveText('1/2');
  await page.goto('/member/nova');
  await expect(page.locator('#profile-name, #missing-title')).toHaveText('Nova Reyes');
  await expect(page.locator('.quest-list > li')).toHaveCount(1);
});

test('reject needs a note, and the note reaches the member', async ({ page }) => {
  const db = seed();
  await openAdmin(page, db);
  await page.getByRole('button', { name: 'Reject with note' }).click();
  await expect(page.getByText('Write a note so the member knows what to change.')).toBeVisible();
  expect(db.profiles.find((r) => r.id === NEW_ID)?.status).toBe('pending_review');

  await page.getByLabel(/Note for the member/).fill('Please add a project link.');
  await page.getByRole('button', { name: 'Reject with note' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Sent Nova Reyes’s card back with your note.');
  expect(db.profiles.find((r) => r.id === NEW_ID)).toMatchObject({ status: 'rejected', review_note: 'Please add a project link.' });
});

test('feature, rename and unpublish a live card', async ({ page }) => {
  const db = seed();
  await openAdmin(page, db);
  await page.getByRole('tab', { name: 'Published (1)' }).click();
  await expect(page.getByRole('region', { name: /Kai Santos/ })).toContainText('No.001');

  // Feature: a toggle that says its state without colour.
  const feature = page.getByRole('button', { name: 'Featured', exact: true });
  await expect(feature).toHaveAttribute('aria-pressed', 'false');
  await feature.click();
  await expect(page.locator('main > .notice')).toContainText('Kai Santos is featured');
  await expect(page.getByRole('button', { name: 'Featured', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('tab', { name: 'Featured (1)' })).toBeVisible();

  // Rename (usernames lock at approval; only admins change them).
  await page.getByText('Change username').click();
  const name = page.getByLabel('Username');
  await name.fill('admin');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByText('That username is reserved. Try another.')).toBeVisible();
  await name.fill('kai-santos');
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.locator('main > .notice')).toContainText('Kai Santos is now @kai-santos');
  expect(db.published[0]?.username).toBe('kai-santos');

  // Unpublish asks first.
  await page.getByRole('button', { name: 'Unpublish…' }).click();
  await page.getByRole('button', { name: 'Keep it' }).click();
  expect(db.published).toHaveLength(1);
  await page.getByRole('button', { name: 'Unpublish…' }).click();
  await page.getByRole('button', { name: 'Yes, unpublish' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Unpublished Kai Santos.');
  await expect(page.getByRole('tab', { name: 'Published (0)' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only')).toContainText('The hall is empty');
});

test('tabs work from the keyboard', async ({ page }) => {
  await openAdmin(page, seed());
  await page.getByRole('tab', { name: 'Pending (2)' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Published (1)' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Published (1)' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Affiliations' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Featured (0)' })).toBeFocused();
  await expect(page.locator('.dialogue .sr-only')).toContainText('No featured cards yet');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight'); // wraps to the first tab
  await expect(page.getByRole('tab', { name: 'Pending (2)' })).toBeFocused();
});

test('a member cannot moderate: the screen turns them away and the database refuses the call', async ({ page }) => {
  const db = seed();
  const log = await mockSupabase(page, { user: MEMBER, db });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admins only' })).toBeVisible();
  expect(log.requests.some((r) => r.includes('/rpc/approve_profile'))).toBe(false);
  // Calling the function directly with the member's session is refused (mirrors supabase/tests).
  const res = await page.evaluate(async (id) => {
    const token = JSON.parse(localStorage.getItem('sb-pip-e2e-auth-token') ?? '{}').access_token;
    // eslint-disable-next-line no-restricted-globals -- runs in the page: a raw call, bypassing the app
    const r = await fetch('https://pip-e2e.supabase.co/rest/v1/rpc/approve_profile', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_id: id }) });
    return { status: r.status, body: await r.json() };
  }, NEW_ID);
  expect(res).toMatchObject({ status: 403, body: { message: 'NOT_ADMIN' } });
  expect(db.published).toHaveLength(1);
});
