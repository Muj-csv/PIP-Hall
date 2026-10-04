// A tiny in-memory stand-in for the database, enough to drive the editor and the admin queue end
// to end. It mimics the rules they depend on (supabase/migrations): members see only their own
// drafts and admins see all; editing a non-draft card sends it back to draft, any project write
// does too; submit needs a draft; max 6 projects; moderation functions refuse non-admins.
import type { Route } from '@playwright/test';

export type Row = Record<string, unknown>;

export interface MockDb {
  profiles: Row[];
  projects: Row[];
  published: Row[];
  uploads: string[];
  githubHandle: string | null;
  /** Set once delete_my_account() ran. */
  deletedAccount?: boolean;
}

export function emptyDb(githubHandle: string | null = null): MockDb {
  return { profiles: [], projects: [], published: [], uploads: [], githubHandle };
}

const CONTENT = ['username', 'full_name', 'tagline', 'bio', 'role', 'org_position', 'department', 'avatar_path', 'linkedin_url', 'portfolio_url', 'public_email', 'show_email', 'skills'];

export interface DbUser {
  id: string;
  role: 'member' | 'admin';
}

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

/** Applies PostgREST eq./in. filters from the query string. */
export function filterRows(rows: Row[], url: URL): Row[] {
  let out = rows;
  for (const [col, v] of url.searchParams) {
    if (NOT_FILTERS.has(col)) continue;
    if (v.startsWith('eq.')) out = out.filter((r) => String(r[col]) === v.slice(3));
    else if (v.startsWith('in.(')) {
      const set = new Set(v.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, '')));
      out = out.filter((r) => set.has(String(r[col])));
    }
  }
  return out;
}

const USERNAME = /^[a-z0-9][a-z0-9_-]{2,19}$/;

/** What build_card() would snapshot. */
function buildCard(db: MockDb, p: Row): Row {
  const projects = db.projects
    .filter((r) => r.profile_id === p.id)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((r) => ({
      title: r.title,
      description: r.description ?? null,
      cover_path: r.cover_path ?? null,
      project_url: r.project_url ?? null,
      github_url: r.github_url ?? null,
      language: r.language ?? null,
      stars: r.stars ?? null,
      tech_stack: r.tech_stack ?? [],
      source: r.source ?? 'manual',
      project_date: r.project_date ?? null,
    }));
  const pick = (k: string) => p[k] ?? null;
  return {
    username: p.username,
    full_name: p.full_name,
    tagline: pick('tagline'),
    bio: pick('bio'),
    role: pick('role'),
    org_position: pick('org_position'),
    department: pick('department'),
    avatar_path: pick('avatar_path'),
    github_username: pick('github_username'),
    linkedin_url: pick('linkedin_url'),
    portfolio_url: pick('portfolio_url'),
    public_email: p.show_email ? pick('public_email') : null,
    skills: p.skills ?? [],
    theme: 'classic',
    is_featured: Boolean(p.is_featured),
    projects,
  };
}

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
export async function handleDb(route: Route, db: MockDb, user: DbUser): Promise<boolean> {
  const userId = user.id;
  const admin = user.role === 'admin';
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
    if (method === 'GET') return (await json(200, filterRows(admin ? db.profiles : db.profiles.filter((r) => r.id === userId), url))), true;
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
      const visible = admin ? db.projects : db.projects.filter((r) => r.profile_id === userId);
      const rows = filterRows(visible, url).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
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
    const rows = filterRows(db.published, url).sort((a, b) => Number(a.member_no) - Number(b.member_no));
    return (await json(200, rows)), true;
  }

  if (url.pathname === '/rest/v1/rpc/submit_for_review') {
    const p = db.profiles.find((r) => r.id === userId);
    if (!p) return (await err(400, 'P0001', 'NO_PROFILE')), true;
    if (p.status !== 'draft') return (await err(400, 'P0001', 'NOT_A_DRAFT')), true;
    p.status = 'pending_review';
    p.review_note = null;
    p.submitted_at = new Date().toISOString();
    return (await json(200, 'pending_review')), true;
  }

  const MODERATION = ['approve_profile', 'reject_profile', 'unpublish_profile', 'set_featured', 'admin_set_username'];
  const fn = url.pathname.replace('/rest/v1/rpc/', '');
  if (url.pathname.startsWith('/rest/v1/rpc/') && MODERATION.includes(fn)) {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const args = body() as { p_id: string; p_note?: string; p_featured?: boolean; p_username?: string };
    const p = db.profiles.find((r) => r.id === args.p_id);
    const live = db.published.find((r) => r.profile_id === args.p_id);
    if (fn === 'approve_profile') {
      if (!p || p.status !== 'pending_review') return (await err(400, 'P0001', 'NOT_PENDING')), true;
      const no = (p.member_no as number | null) ?? Math.max(0, ...db.profiles.map((r) => Number(r.member_no ?? 0)), ...db.published.map((r) => Number(r.member_no))) + 1;
      Object.assign(p, { status: 'approved', review_note: null, username_locked: true, member_no: no });
      const row = { profile_id: p.id, username: p.username, card: buildCard(db, p), is_featured: Boolean(p.is_featured), published_at: new Date().toISOString(), member_no: no };
      if (live) Object.assign(live, row);
      else db.published.push(row);
    } else if (fn === 'reject_profile') {
      if (!args.p_note?.trim()) return (await err(400, 'P0001', 'NOTE_REQUIRED')), true;
      if (!p || p.status !== 'pending_review') return (await err(400, 'P0001', 'NOT_PENDING')), true;
      Object.assign(p, { status: 'rejected', review_note: args.p_note.slice(0, 280) });
    } else if (fn === 'unpublish_profile') {
      if (!live) return (await err(400, 'P0001', 'NOT_PUBLISHED')), true;
      db.published.splice(db.published.indexOf(live), 1);
      if (p) Object.assign(p, { status: 'unpublished', is_featured: false });
    } else if (fn === 'set_featured') {
      if (!live) return (await err(400, 'P0001', 'NOT_PUBLISHED')), true;
      live.is_featured = args.p_featured;
      (live.card as Row).is_featured = args.p_featured;
      if (p) p.is_featured = args.p_featured;
    } else {
      const name = (args.p_username ?? '').trim().toLowerCase();
      if (!p) return (await err(400, 'P0001', 'NO_PROFILE')), true;
      if (!USERNAME.test(name)) return (await err(400, '23514', 'new row violates check constraint "profiles_username_check"')), true;
      if (db.profiles.some((r) => r.username === name && r.id !== p.id)) return (await err(409, '23505', 'duplicate key value violates unique constraint "profiles_username_key"')), true;
      p.username = name;
      if (live) {
        live.username = name;
        (live.card as Row).username = name;
      }
    }
    return (await json(200, null)), true;
  }

  if (url.pathname === '/rest/v1/rpc/sync_github_identity') {
    const p = db.profiles.find((r) => r.id === userId);
    if (p) p.github_username = db.githubHandle;
    return (await json(200, db.githubHandle)), true;
  }

  if (url.pathname === '/rest/v1/rpc/delete_my_account') {
    db.profiles = db.profiles.filter((r) => r.id !== userId);
    db.projects = db.projects.filter((r) => r.profile_id !== userId);
    db.published = db.published.filter((r) => r.profile_id !== userId);
    db.deletedAccount = true;
    return (await route.fulfill({ status: 204 })), true;
  }

  // Storage: list and remove the member's own files (RLS keeps everyone to their own folder).
  const list = url.pathname.match(/^\/storage\/v1\/object\/list\/(avatars|project-covers)$/);
  if (list && method === 'POST') {
    const prefix = String(body().prefix ?? '');
    if (prefix !== userId) return (await json(200, [])), true;
    const files = list[1] === 'avatars' ? db.uploads.filter((p) => p.startsWith(`${userId}/`)) : [];
    return (await json(200, files.map((p) => ({ name: p.slice(userId.length + 1), id: crypto.randomUUID(), metadata: {} })))), true;
  }
  const remove = url.pathname.match(/^\/storage\/v1\/object\/(avatars|project-covers)$/);
  if (remove && method === 'DELETE') {
    const prefixes: string[] = body().prefixes ?? [];
    if (prefixes.some((p) => !p.startsWith(`${userId}/`))) return (await err(403, '403', 'new row violates row-level security policy')), true;
    db.uploads = db.uploads.filter((p) => !prefixes.includes(p));
    return (await json(200, prefixes.map((name) => ({ name })))), true;
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
