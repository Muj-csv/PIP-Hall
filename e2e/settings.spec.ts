// Phase 5 acceptance (FR-16): email choices, theme, sign out, and deleting the account with an
// in-page confirm. Supabase is mocked (e2e/mockDb.ts).
import { expect, test } from '@playwright/test';
import { emptyDb, type MockDb } from './mockDb';
import { mockSupabase } from './mockSupabase';

const USER = { id: '00000000-0000-4000-8000-0000000000a1', email: 'member@example.org', name: 'Test Member', github: 'octocat', role: 'member' as const };

test.skip(({ isMobile }) => isMobile, 'settings flows are viewport-independent; desktop covers them');

function withCard(status = 'approved'): MockDb {
  const db = emptyDb('octocat');
  db.profiles.push({
    id: USER.id, username: 'octocat', full_name: 'Test Member', tagline: null, bio: null, role: null, org_position: null, department: null,
    avatar_path: `${USER.id}/a.webp`, github_username: 'octocat', linkedin_url: null, portfolio_url: null, public_email: 'me@example.org',
    show_email: false, email_updates: false, skills: [], status, review_note: null, is_featured: false, username_locked: true, member_no: 1,
  });
  db.published.push({ profile_id: USER.id, username: 'octocat', is_featured: false, published_at: '2026-10-04T00:00:00Z', member_no: 1, card: {} });
  db.uploads.push(`${USER.id}/a.webp`, `${USER.id}/old.webp`);
  return db;
}

test('signed-out visitors are sent to sign in first', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
});

test('email choices save; showing the email warns that the card goes back to review', async ({ page }) => {
  const db = withCard();
  await mockSupabase(page, { user: USER, db });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const save = page.getByRole('button', { name: 'Save email choices' });
  await expect(save).toBeDisabled();

  await page.getByLabel('Email me about my card').check();
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveText('Saved.');
  expect(db.profiles[0]).toMatchObject({ email_updates: true, status: 'approved' });

  await expect(page.getByText(/Shows me@example.org .* sends your card back to review/)).toBeVisible();
  await page.getByLabel('Show my email on my card').check();
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toContainText('went back to draft');
  expect(db.profiles[0]).toMatchObject({ show_email: true, status: 'draft' });
});

test('without a card, Settings points to the editor', async ({ page }) => {
  await mockSupabase(page, { user: USER });
  await page.goto('/settings');
  await expect(page.locator('.dialogue .sr-only')).toContainText('Make your card first');
});

test('the world switch here and in the top bar stay in step', async ({ page }) => {
  await mockSupabase(page, { user: USER, db: withCard() });
  await page.goto('/settings');
  await page.getByRole('region', { name: 'World' }).getByText('NIGHT', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('header').getByRole('button', { name: /^World:/ })).toHaveText('World: NIGHT');
});

test('delete account: confirm by typing the username; images, account and card go, then signed out', async ({ page }) => {
  const db = withCard();
  const log = await mockSupabase(page, { user: USER, db });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete my account…' }).click();
  const forever = page.getByRole('button', { name: 'Delete forever' });
  await expect(forever).toBeDisabled();

  // Changing your mind leaves everything alone.
  await page.getByRole('button', { name: 'Keep my account' }).click();
  await expect(page.getByRole('button', { name: 'Delete my account…' })).toBeFocused();
  await page.getByRole('button', { name: 'Delete my account…' }).click();

  await page.getByLabel('Type octocat to confirm').fill('octo');
  await expect(forever).toBeDisabled();
  await page.getByLabel('Type octocat to confirm').fill('OctoCat');
  await forever.click();

  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByRole('link', { name: 'Make your card' })).toBeVisible();
  expect(db.uploads).toEqual([]);
  expect(db.deletedAccount).toBe(true);
  expect(db.published).toEqual([]);
  const order = log.requests.filter((r) => /storage\/v1\/object\/avatars$|delete_my_account|auth\/v1\/logout/.test(r));
  expect(order).toEqual(['DELETE /storage/v1/object/avatars', 'POST /rest/v1/rpc/delete_my_account', 'POST /auth/v1/logout?scope=global']);
});

test('the card editor links to Settings', async ({ page }) => {
  await mockSupabase(page, { user: USER, db: withCard() });
  await page.goto('/edit');
  await page.getByRole('region', { name: 'Account' }).getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});
