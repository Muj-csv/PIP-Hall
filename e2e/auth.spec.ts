// Phase 2 acceptance (docs/build/PHASE-2.md): sign-in entry, callback errors, protected
// routes, connect GitHub, sign out. Supabase is mocked (e2e/mockSupabase.ts).
import { expect, test } from '@playwright/test';
import { FAKE_SUPABASE_URL, mockSupabase } from './mockSupabase';

const MEMBER = { id: '00000000-0000-4000-8000-0000000000a1', email: 'member@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };

test.skip(({ isMobile }) => isMobile, 'auth flows are viewport-independent; desktop covers them');

test('Make your card leads to Continue with Google, which asks only for openid email profile', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Make your card' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const nav = page.waitForRequest((r) => r.url().startsWith(`${FAKE_SUPABASE_URL}/auth/v1/authorize`));
  await page.route(`${FAKE_SUPABASE_URL}/auth/v1/authorize**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'google (mock)' }));
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const url = new URL((await nav).url());
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('scopes')).toBe('openid email profile');
  expect(url.searchParams.get('redirect_to')).toBe('http://localhost:5173/auth/callback?next=%2Fedit');
  expect(url.searchParams.get('code_challenge')).toBeTruthy(); // PKCE
});

test('signed-out visitors are sent to sign in, and come back where they were going', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/edit');
  await expect(page).toHaveURL(/\/login\?next=%2Fedit$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
});

test('a GitHub account linked elsewhere gets a clear explanation (identity_already_exists)', async ({ page }) => {
  await mockSupabase(page, { user: MEMBER });
  await page.goto('/auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user');
  await expect(page.getByRole('heading', { name: 'GitHub not connected' })).toBeVisible();
  await expect(page.locator('.dialogue .sr-only')).toContainText('Sign in with the Google account that owns it');
  await expect(page.getByRole('link', { name: 'Back to my card' })).toHaveAttribute('href', '/edit');
});

test('a cancelled Google sign-in says so and offers to try again', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/auth/callback?error=access_denied&error_description=denied&next=%2Fedit');
  await expect(page.getByRole('heading', { name: 'Sign-in didn’t finish' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/login?next=%2Fedit');
});

test('the callback refuses to redirect off-site', async ({ page }) => {
  await mockSupabase(page, { user: MEMBER });
  await page.goto('/auth/callback?next=https%3A%2F%2Fevil.example');
  await expect(page).toHaveURL(/localhost:5173\/edit$/);
});

test('a member can connect GitHub; it asks Supabase to link the identity and goes to GitHub', async ({ page }) => {
  const log = await mockSupabase(page, { user: MEMBER });
  await page.goto('/edit');
  await expect(page.getByRole('heading', { name: 'My card', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Account' })).toContainText('member@example.org');
  await page.getByRole('button', { name: 'Connect GitHub' }).click();
  await expect(page).toHaveURL(/github\.com\/login\/oauth\/authorize/);
  const link = log.requests.find((r) => r.startsWith('GET /auth/v1/user/identities/authorize'));
  const params = new URL(`https://x${link!.slice(4)}`).searchParams;
  expect(params.get('provider')).toBe('github');
  expect(params.get('redirect_to')).toBe('http://localhost:5173/auth/callback?next=%2Fedit');
});

test('after connecting, the verified handle shows and the callback syncs it to the profile', async ({ page }) => {
  const log = await mockSupabase(page, { user: { ...MEMBER, github: 'octocat' }, githubRepos: [] });
  await page.goto('/auth/callback?next=%2Fedit');
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByRole('region', { name: 'Projects' })).toContainText('Public repos of @octocat');
  await expect(page.locator('.preview-stage .sticker').first()).toHaveText('✓ GITHUB');
  expect(log.requests).toContain('POST /rest/v1/rpc/sync_github_identity');
});

test('a member who opens /admin is turned away; an admin gets in', async ({ page, browser }) => {
  await mockSupabase(page, { user: MEMBER });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admins only' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  const ctx = await browser.newContext();
  const adminPage = await ctx.newPage();
  await mockSupabase(adminPage, { user: ADMIN });
  await adminPage.goto('http://localhost:5173/admin');
  await expect(adminPage.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();
  await expect(adminPage.getByRole('link', { name: 'Admin' })).toBeVisible();
  await ctx.close();
});

test('signing out returns to the hall as a visitor', async ({ page }) => {
  const log = await mockSupabase(page, { user: MEMBER });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'My card' })).toBeVisible();
  await page.getByRole('link', { name: 'My card' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByRole('link', { name: 'Make your card' })).toBeVisible();
  expect(log.requests.some((r) => r.startsWith('POST /auth/v1/logout'))).toBe(true);
});

test('opened inside Messenger, the login page says to open it in a real browser', async ({ browser }) => {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/450.0]',
  });
  const page = await ctx.newPage();
  await mockSupabase(page);
  await page.goto('/login');
  await expect(page.locator('.dialogue .sr-only')).toContainText('Google doesn’t allow sign-in inside Messenger’s browser');
  await ctx.close();
});

test('a device clock hours ahead does not loop token refreshes and role lookups', async ({ page }) => {
  // With the clock 15 hours ahead, every token looks expired.
  await page.clock.setSystemTime(new Date(Date.now() + 15 * 3600 * 1000));
  const log = await mockSupabase(page, { user: MEMBER });
  await page.goto('/edit');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.waitForTimeout(1500);
  const roleReads = log.requests.filter((r) => r.startsWith('GET /rest/v1/user_roles')).length;
  expect(roleReads).toBeLessThanOrEqual(2);
});
