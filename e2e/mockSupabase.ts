// A fake Supabase for e2e: intercepts every request to the fake project origin, so tests can
// be signed out, a member or an admin without any real accounts or network.
import type { Page, Route } from '@playwright/test';
import { emptyDb, filterRows, handleDb, type MockDb, type Row } from './mockDb';

export const FAKE_SUPABASE_URL = 'https://pip-e2e.supabase.co';
const STORAGE_KEY = 'sb-pip-e2e-auth-token';

export interface MockOptions {
  /** Signed-in user, or null for signed out. */
  user?: { id: string; email: string; name: string; github?: string; role: 'member' | 'admin' } | null;
  /** Rows for GET /rest/v1/published_cards. */
  publishedCards?: unknown[];
  /** Status for published_cards (e.g. 500 to test the error state). */
  publishedStatus?: number;
  /** Stateful rows for the card editor (profiles, projects, storage, RPCs). */
  db?: MockDb;
  /** GET api.github.com/users/:handle/repos: a list, or a rate-limit answer. */
  githubRepos?: unknown[] | { rateLimitedUntil: Date };
}

export interface MockLog {
  requests: string[];
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export async function mockSupabase(page: Page, opts: MockOptions = {}): Promise<MockLog> {
  const log: MockLog = { requests: [] };
  const user = opts.user ?? null;
  // Signed-in pages read the member's own rows; default to an empty account.
  const db = opts.db ?? (user ? emptyDb(user.github ?? null) : undefined);
  let session: Record<string, unknown> | null = null;

  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, role: 'authenticated', exp: now + 3600 })}.sig`;
    const identities = [
      { provider: 'google', identity_data: { email: user.email } },
      ...(user.github ? [{ provider: 'github', identity_data: { user_name: user.github } }] : []),
    ];
    session = {
      access_token: jwt,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'e2e-refresh',
      user: { id: user.id, aud: 'authenticated', email: user.email, user_metadata: { full_name: user.name }, app_metadata: {}, identities },
    };
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(session)] as const);
  }

  await page.route(`${FAKE_SUPABASE_URL}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    log.requests.push(`${req.method()} ${url.pathname}${url.search}`);
    if (db && (await handleDb(route, db, user ? { id: user.id, role: user.role } : { id: '', role: 'anon' }))) return;
    const json = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname === '/rest/v1/user_roles') return json(200, user ? [{ role: user.role }] : []);
    if (url.pathname === '/rest/v1/published_cards') return json(opts.publishedStatus ?? 200, opts.publishedStatus ? { message: 'boom' } : filterRows((opts.publishedCards ?? []) as Row[], url));
    if (url.pathname === '/rest/v1/rpc/sync_github_identity') return json(200, user?.github ?? null);
    if (url.pathname === '/auth/v1/user/identities/authorize') return json(200, { url: 'https://github.com/login/oauth/authorize?client_id=e2e' });
    if (url.pathname === '/auth/v1/token' && session) return json(200, session); // token refresh
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (url.pathname === '/auth/v1/user') return json(200, user ? { id: user.id, email: user.email } : {});
    return json(404, { message: `unmocked ${url.pathname}` });
  });

  if (opts.githubRepos) {
    const repos = opts.githubRepos;
    await page.route('https://api.github.com/users/*/repos*', (route) => {
      log.requests.push(`GET ${new URL(route.request().url()).pathname}`);
      return Array.isArray(repos)
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(repos) })
        : route.fulfill({
            status: 403,
            contentType: 'application/json',
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(repos.rateLimitedUntil.getTime() / 1000)), 'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset' },
            body: JSON.stringify({ message: 'API rate limit exceeded' }),
          });
    });
  }

  // OAuth pages are outside the app: record the attempt and stop there.
  await page.route('https://github.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>GitHub (mock)</h1>' }));
  return log;
}
