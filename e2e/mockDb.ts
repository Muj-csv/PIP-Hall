// A tiny in-memory stand-in for the member's own rows, enough to drive the card editor end to end.
// It mimics the database rules the editor depends on (supabase/migrations): editing a non-draft
// card sends it back to draft, any project write does too, submit needs a draft, max 6 projects.
import type { Route } from '@playwright/test';

export type Row = Record<string, unknown>;

export interface MockDb {
  profiles: Row[];
  projects: Row[];
  published: Row[];
  uploads: string[];
  githubHandle: string | null;
}

export function emptyDb(githubHandle: string | null = null): MockDb {
  return { profiles: [], projects: [], published: [], uploads: [], githubHandle };
}

const CONTENT = ['username', 'full_name', 'tagline', 'bio', 'role', 'org_position', 'department', 'avatar_path', 'linkedin_url', 'portfolio_url', 'public_email', 'show_email', 'skills'];

function eqFilter(url: URL, col: string): string | null {
  const v = url.searchParams.get(col);
  return v?.startsWith('eq.') ? v.slice(3) : null;
}

function inFilter(url: URL, col: string): string[] | null {
  const v = url.searchParams.get(col);
  if (!v?.startsWith('in.(')) return null;
  return v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, ''));
}

/** Handles /rest/v1 and /storage/v1 for the editor. Returns false if the request isn't one it knows. */
export async function handleDb(route: Route, db: MockDb, userId: string): Promise<boolean> {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const body = () => (req.postData() ? JSON.parse(req.postData()!) : null);
  const json = (status: number, data: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const err = (status: number, code: string, message: string) => json(status, { code, message, details: null, hint: null });
  const toDraft = (id: string) => {
    const p = db.profiles.find((r) => r.id === id);
    if (p && p.status !== 'draft') p.status = 'draft';
  };

  if (url.pathname === '/rest/v1/profiles') {
    if (method === 'GET') return (await json(200, db.profiles.filter((r) => r.id === (eqFilter(url, 'id') ?? userId)))), true;
    if (method === 'POST') {
      const row = body();
      if (db.profiles.some((r) => r.username === row.username)) return (await err(409, '23505', 'duplicate key value violates unique constraint "profiles_username_key"')), true;
      db.profiles.push({ github_username: null, status: 'draft', review_note: null, is_featured: false, username_locked: false, member_no: null, email_updates: false, show_email: false, skills: [], ...row });
      return (await route.fulfill({ status: 201 })), true;
    }
    if (method === 'PATCH') {
      const p = db.profiles.find((r) => r.id === eqFilter(url, 'id'));
      if (!p) return (await route.fulfill({ status: 204 })), true;
      const patch = body();
      if (p.username_locked && 'username' in patch && patch.username !== p.username) return (await err(400, 'P0001', 'USERNAME_LOCKED')), true;
      const changed = CONTENT.some((k) => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(p[k]));
      Object.assign(p, patch);
      if (changed && p.status !== 'draft') p.status = 'draft';
      return (await route.fulfill({ status: 204 })), true;
    }
  }

  if (url.pathname === '/rest/v1/projects') {
    if (method === 'GET') {
      const rows = db.projects.filter((r) => r.profile_id === (eqFilter(url, 'profile_id') ?? userId)).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      return (await json(200, rows)), true;
    }
    if (method === 'POST') {
      const rows: Row[] = [].concat(body());
      for (const row of rows) {
        if (db.projects.filter((r) => r.profile_id === row.profile_id).length >= 6) return (await err(400, 'P0001', 'PROJECT_LIMIT')), true;
        db.projects.push({ id: crypto.randomUUID(), ...row });
        toDraft(String(row.profile_id));
      }
      return (await route.fulfill({ status: 201 })), true;
    }
    if (method === 'PATCH') {
      const p = db.projects.find((r) => r.id === eqFilter(url, 'id'));
      if (p) {
        Object.assign(p, body());
        toDraft(String(p.profile_id));
      }
      return (await route.fulfill({ status: 204 })), true;
    }
    if (method === 'DELETE') {
      const ids = inFilter(url, 'id') ?? [];
      for (const id of ids) {
        const i = db.projects.findIndex((r) => r.id === id);
        if (i >= 0) {
          toDraft(String(db.projects[i]!.profile_id));
          db.projects.splice(i, 1);
        }
      }
      return (await route.fulfill({ status: 204 })), true;
    }
  }

  if (url.pathname === '/rest/v1/published_cards' && method === 'GET') {
    const pid = eqFilter(url, 'profile_id');
    return (await json(200, pid ? db.published.filter((r) => r.profile_id === pid) : db.published)), true;
  }

  if (url.pathname === '/rest/v1/rpc/submit_for_review') {
    const p = db.profiles.find((r) => r.id === userId);
    if (!p) return (await err(400, 'P0001', 'NO_PROFILE')), true;
    if (p.status !== 'draft') return (await err(400, 'P0001', 'NOT_A_DRAFT')), true;
    p.status = 'pending_review';
    p.review_note = null;
    return (await json(200, 'pending_review')), true;
  }

  if (url.pathname === '/rest/v1/rpc/sync_github_identity') {
    const p = db.profiles.find((r) => r.id === userId);
    if (p) p.github_username = db.githubHandle;
    return (await json(200, db.githubHandle)), true;
  }

  if (url.pathname.startsWith('/storage/v1/object/avatars/') && method === 'POST') {
    const path = url.pathname.replace('/storage/v1/object/avatars/', '');
    if (!path.startsWith(`${userId}/`)) return (await err(403, '403', 'new row violates row-level security policy')), true;
    db.uploads.push(path);
    return (await json(200, { Key: `avatars/${path}`, Id: crypto.randomUUID() })), true;
  }

  return false;
}

/** A 2×2 PNG, enough for the browser to decode and re-encode as WebP. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);
