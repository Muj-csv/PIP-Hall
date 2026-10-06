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
  /** PIP Progression E1 (mirrors supabase/migrations/*_pips_core.sql). */
  ledger?: Row[];
  discoveries?: Row[];
  memberAchievements?: Row[];
  /** MUSEUM and affiliations (mirrors supabase/migrations/*_museum.sql). */
  affiliations?: Row[];
  memberAffiliations?: Row[];
  museumEntries?: Row[];
  /** PIP MART (mirrors supabase/migrations/*_pip_mart.sql). */
  inventory?: Row[];
  appearance?: Row[];
  /** Borders and badges designed in Admin → Rewards (D-087). */
  customItems?: Row[];
  customBadges?: Row[];
  /** Project collaborators (D-089): {project_id, member_id, status}. */
  collabs?: Row[];
}

export const MART_ITEMS = [
  { key: 'meadow', kind: 'frame', name: 'Meadow Frame', description: 'Hill green with little flowers in bloom.', price: 200, sort: 1 },
  { key: 'dusk', kind: 'frame', name: 'Dusk Frame', description: 'Deep plum with stars in the corners.', price: 400, sort: 2 },
  { key: 'pearl', kind: 'frame', name: 'Pearl Frame', description: 'Soft cream with polished pearls.', price: 700, sort: 3 },
  { key: 'gold', kind: 'frame', name: 'Gold Frame', description: "Block gold with coins. For the hall's finest.", price: 1000, sort: 4 },
];

const perkLabel = (name: string) => (/(^| )MEMBER$/.test(name.trim().toUpperCase()) ? name.trim().toUpperCase() : `${name.trim().toUpperCase()} MEMBER`);

export const ACHIEVEMENTS = [
  { key: 'first_card', name: 'Card Holder', description: 'Your card was approved for the first time.', reward: 50, sort: 1 },
  { key: 'first_project', name: 'First Quest', description: 'Your first project went live.', reward: 50, sort: 2 },
  { key: 'builder', name: 'Builder', description: '5 of your projects went live.', reward: 150, sort: 3 },
  { key: 'explorer', name: 'Explorer', description: 'You discovered 10 members.', reward: 100, sort: 4 },
  { key: 'hall_walker', name: 'Hall Walker', description: 'You discovered 50 members.', reward: 200, sort: 5 },
];

function grant(db: MockDb, member: string, amount: number, reason: string, ref: string): boolean {
  db.ledger ??= [];
  if (db.ledger.some((r) => r.member_id === member && r.ref === ref)) return false;
  db.ledger.push({ id: db.ledger.length + 1, member_id: member, amount, reason, ref, created_at: new Date(Date.now() + db.ledger.length).toISOString() });
  return true;
}

function checkAchievements(db: MockDb, member: string): string[] {
  db.memberAchievements ??= [];
  const live = (db.ledger ?? []).filter((r) => r.member_id === member && r.reason === 'project_live').length;
  const found = (db.discoveries ?? []).filter((r) => r.member_id === member).length;
  const hold: Record<string, boolean> = {
    first_card: (db.ledger ?? []).some((r) => r.member_id === member && r.ref === 'first_approval'),
    first_project: live >= 1,
    builder: live >= 5,
    explorer: found >= 10,
    hall_walker: found >= 50,
  };
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!hold[a.key] || db.memberAchievements.some((r) => r.member_id === member && r.key === a.key)) continue;
    db.memberAchievements.push({ member_id: member, key: a.key });
    grant(db, member, a.reward, 'achievement', `achievement:${a.key}`);
    unlocked.push(a.key);
  }
  return unlocked;
}

export function rewardApproval(db: MockDb, member: string): void {
  grant(db, member, 100, 'first_approval', 'first_approval');
  for (const p of db.projects.filter((r) => r.profile_id === member)) {
    if ((db.ledger ?? []).filter((r) => r.member_id === member && r.reason === 'project_live').length >= 12) break;
    grant(db, member, 25, 'project_live', `project:${String(p.id)}`);
  }
  checkAchievements(db, member);
}

const balanceOf = (db: MockDb, member: string) => (db.ledger ?? []).filter((r) => r.member_id === member).reduce((n, r) => n + Number(r.amount), 0);

export function emptyDb(githubHandle: string | null = null): MockDb {
  return { profiles: [], projects: [], published: [], uploads: [], githubHandle };
}

const PROJECT_UPDATABLE = new Set(['title', 'description', 'cover_path', 'project_url', 'github_url', 'language', 'stars', 'tech_stack', 'project_date', 'sort_order']);

const CONTENT = ['username', 'full_name', 'tagline', 'bio', 'role', 'org_position', 'department', 'avatar_path', 'linkedin_url', 'portfolio_url', 'public_email', 'show_email', 'skills'];

export interface DbUser {
  id: string;
  role: 'member' | 'admin' | 'anon';
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
      id: r.id,
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
      // Like the column grant in the init migration: source and github_repo_id are fixed at insert.
      if (Object.keys(body()).some((k) => !PROJECT_UPDATABLE.has(k))) return (await err(403, '42501', 'permission denied for table projects')), true;
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
      // The Museum follows the approved card (D-071).
      const kept = new Set(((row.card as Row).projects as Row[]).map((x) => String(x.id)));
      db.museumEntries = (db.museumEntries ?? []).filter((e) => e.member_id !== p.id || kept.has(String(e.project_id)));
      rewardApproval(db, String(p.id));
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

  const inHall = (id: string) => db.published.some((r) => r.profile_id === id);
  if (url.pathname === '/rest/v1/rpc/my_pips') return (await json(200, { eligible: inHall(userId), balance: balanceOf(db, userId) })), true;
  if (url.pathname === '/rest/v1/rpc/discover_card') {
    const card = String(body().p_card);
    const none = { granted: false, amount: 0, unlocked: [], balance: balanceOf(db, userId) };
    if (card === userId || !inHall(userId) || !inHall(card)) return (await json(200, none)), true;
    db.discoveries ??= [];
    if (db.discoveries.some((r) => r.member_id === userId && r.card_id === card)) return (await json(200, { ...none, new: false })), true;
    db.discoveries.push({ member_id: userId, card_id: card });
    const today = (db.ledger ?? []).filter((r) => r.member_id === userId && r.reason === 'discover').reduce((n, r) => n + Number(r.amount), 0);
    const paid = today + 5 <= 100 && grant(db, userId, 5, 'discover', `discover:${card}`);
    const unlocked = checkAchievements(db, userId);
    return (await json(200, { granted: paid, new: true, amount: paid ? 5 : 0, unlocked, balance: balanceOf(db, userId) })), true;
  }
  if (url.pathname === '/rest/v1/pip_ledger' && method === 'GET') {
    const rows = (db.ledger ?? []).filter((r) => r.member_id === userId).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return (await json(200, rows.slice(0, Number(url.searchParams.get('limit') ?? 50)))), true;
  }
  if (url.pathname === '/rest/v1/achievements' && method === 'GET') return (await json(200, [...ACHIEVEMENTS, ...(db.customBadges ?? [])])), true;
  if (url.pathname === '/rest/v1/member_achievements' && method === 'GET') {
    const rows = filterRows(db.memberAchievements ?? [], url).filter((r) => inHall(String(r.member_id)));
    return (await json(200, rows)), true;
  }

  // ---- MUSEUM and affiliations
  const hasMuseum = (id: string) => (db.memberAffiliations ?? []).some((m) => m.member_id === id && (db.affiliations ?? []).some((a) => a.key === m.key && a.grants_museum));
  const liveIds = (id: string) => (((db.published.find((r) => r.profile_id === id)?.card as Row | undefined)?.projects as Row[] | undefined) ?? []).map((p) => String(p.id)).filter((x) => x !== 'undefined');
  if (url.pathname === '/rest/v1/affiliations' && method === 'GET') return (await json(200, [...(db.affiliations ?? [])].sort((a, b) => Number(a.sort) - Number(b.sort)))), true;
  if (url.pathname === '/rest/v1/member_affiliations' && method === 'GET') {
    const rows = filterRows(db.memberAffiliations ?? [], url).filter((r) => admin || inHall(String(r.member_id)));
    return (await json(200, rows)), true;
  }
  const AFF_ADMIN = ['admin_save_affiliation', 'admin_delete_affiliation', 'set_member_affiliation'];
  if (url.pathname.startsWith('/rest/v1/rpc/') && AFF_ADMIN.includes(fn)) {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const a = body() as { p_key: string; p_name?: string; p_grants_museum?: boolean; p_member?: string; p_on?: boolean };
    db.affiliations ??= [];
    db.memberAffiliations ??= [];
    if (fn === 'admin_save_affiliation') {
      if (!/^[a-z0-9][a-z0-9-]{1,23}$/.test(a.p_key)) return (await err(400, '23514', 'new row violates check constraint')), true;
      const found = db.affiliations.find((r) => r.key === a.p_key);
      if (found) Object.assign(found, { name: a.p_name, grants_museum: a.p_grants_museum });
      else db.affiliations.push({ key: a.p_key, name: a.p_name, grants_museum: a.p_grants_museum, frame_key: null, sort: db.affiliations.length + 1 });
    } else if (fn === 'admin_delete_affiliation') {
      db.affiliations = db.affiliations.filter((r) => r.key !== a.p_key);
      db.memberAffiliations = db.memberAffiliations.filter((r) => r.key !== a.p_key);
    } else {
      db.memberAffiliations = db.memberAffiliations.filter((r) => !(r.member_id === a.p_member && r.key === a.p_key));
      if (a.p_on) db.memberAffiliations.push({ member_id: a.p_member, key: a.p_key });
    }
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/my_museum') {
    const approved = (((db.published.find((r) => r.profile_id === userId)?.card as Row | undefined)?.projects as Row[] | undefined) ?? []).filter((p) => p.id).map((p) => ({ id: p.id, title: p.title }));
    return (await json(200, { access: hasMuseum(userId), live: liveIds(userId), projects: approved, entries: (db.museumEntries ?? []).filter((e) => e.member_id === userId).map((e) => e.project_id),
      consoles: Object.fromEntries((db.museumEntries ?? []).filter((e) => e.member_id === userId && e.console).map((e) => [e.project_id, e.console])) })), true;
  }
  if (url.pathname === '/rest/v1/rpc/set_museum_console') {
    const { p_project, p_console } = body() as { p_project: string; p_console: string | null };
    if (p_console !== null && !['pocket', 'wide', 'tv', 'arcade', 'flip'].includes(p_console)) return (await err(400, 'P0001', 'BAD_CONSOLE')), true;
    const entry = (db.museumEntries ?? []).find((e) => e.project_id === p_project && e.member_id === userId);
    if (!entry) return (await err(400, 'P0001', 'NOT_IN_MUSEUM')), true;
    entry.console = p_console;
    return (await json(200, p_console)), true;
  }
  if (url.pathname === '/rest/v1/rpc/set_museum') {
    const { p_project, p_on } = body() as { p_project: string; p_on: boolean };
    db.museumEntries ??= [];
    if (!p_on) {
      db.museumEntries = db.museumEntries.filter((e) => !(e.project_id === p_project && e.member_id === userId));
      return (await json(200, false)), true;
    }
    const live = liveIds(userId).includes(p_project);
    if (!live && !db.projects.some((p) => p.id === p_project && p.profile_id === userId)) return (await err(400, 'P0001', 'NOT_YOURS')), true;
    if (!hasMuseum(userId)) return (await err(400, 'P0001', 'NO_MUSEUM_ACCESS')), true;
    if (!liveIds(userId).includes(p_project)) return (await err(400, 'P0001', 'NOT_LIVE')), true;
    if (!db.museumEntries.some((e) => e.project_id === p_project)) db.museumEntries.push({ project_id: p_project, member_id: userId });
    return (await json(200, true)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_museum_summary') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const rows = db.published.filter((c) => hasMuseum(String(c.profile_id))).map((c) => ({
      profile_id: c.profile_id,
      username: c.username,
      full_name: (c.card as Row).full_name,
      projects: (((c.card as Row).projects as Row[] | undefined) ?? []).length,
      exhibits: (db.museumEntries ?? []).filter((e) => e.member_id === c.profile_id).length,
    }));
    return (await json(200, rows)), true;
  }
  if (url.pathname === '/rest/v1/rpc/museum_exhibits') {
    const out = (db.museumEntries ?? []).flatMap((e) => {
      const c = db.published.find((r) => r.profile_id === e.member_id);
      const card = c?.card as Row | undefined;
      const project = ((card?.projects as Row[] | undefined) ?? []).find((p) => p.id === e.project_id);
      if (!c || !project || !hasMuseum(String(e.member_id))) return [];
      return [{ project_id: e.project_id, username: c.username, full_name: card!.full_name, avatar_path: card!.avatar_path ?? null, member_no: c.member_no, featured: Boolean(c.is_featured), console: e.console ?? null, project }];
    });
    return (await json(200, out)), true;
  }

  // ---- PIP MART (with admin-made borders, D-087)
  const allItems = (): Row[] => [...MART_ITEMS.map((m) => ({ ...m, for_sale: true, active: true, style: null })), ...(db.customItems ?? [])];
  const owns = (id: string, key: string) => (db.inventory ?? []).some((r) => r.member_id === id && r.item_key === key);
  const perksOf = (id: string) =>
    (db.memberAffiliations ?? [])
      .filter((m) => m.member_id === id)
      .map((m) => (db.affiliations ?? []).find((a) => a.key === m.key && a.frame_key === 'member'))
      .filter((a): a is Row => Boolean(a))
      .map((a) => ({ key: a.key, name: a.name, label: perkLabel(String(a.name)) }));
  const validFrame = (id: string) => {
    const a = (db.appearance ?? []).find((r) => r.member_id === id);
    if (!a?.frame) return null;
    if (a.frame === 'member') {
      const p = perksOf(id).find((x) => x.key === a.frame_affiliation);
      return p ? { frame: 'member', label: p.label } : null;
    }
    const item = allItems().find((m) => m.key === a.frame);
    return owns(id, String(a.frame)) ? { frame: a.frame, label: null, style: item?.style ?? null } : null;
  };
  if (url.pathname === '/rest/v1/rpc/my_mart') {
    if (!userId) return (await err(401, '42501', 'permission denied for function my_mart')), true;
    const a = (db.appearance ?? []).find((r) => r.member_id === userId);
    return (await json(200, {
      eligible: inHall(userId),
      balance: balanceOf(db, userId),
      items: allItems()
        .filter((m) => (m.active && m.for_sale) || owns(userId, String(m.key)))
        .map((m) => ({ key: m.key, kind: 'frame', name: m.name, description: m.description, price: m.price, for_sale: m.for_sale, style: m.style, owned: owns(userId, String(m.key)) })),
      perks: perksOf(userId),
      equipped: { frame: a?.frame ?? null, affiliation: a?.frame_affiliation ?? null },
    })), true;
  }
  if (url.pathname === '/rest/v1/rpc/buy_item') {
    const { p_key } = body() as { p_key: string };
    if (!userId) return (await err(401, '42501', 'permission denied for function buy_item')), true;
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const item = allItems().find((m) => m.key === p_key && m.active && m.for_sale) as { price: number } | undefined;
    if (!item) return (await err(400, 'P0001', 'NO_SUCH_ITEM')), true;
    if (owns(userId, p_key)) return (await err(400, 'P0001', 'ALREADY_OWNED')), true;
    const bal = balanceOf(db, userId);
    if (bal < item.price) return (await err(400, 'P0001', 'NOT_ENOUGH_PIPS')), true;
    db.ledger ??= [];
    db.ledger.push({ id: db.ledger.length + 1, member_id: userId, amount: -item.price, reason: 'purchase', ref: `buy:${p_key}`, created_at: new Date().toISOString() });
    (db.inventory ??= []).push({ member_id: userId, item_key: p_key });
    return (await json(200, { balance: bal - item.price })), true;
  }
  if (url.pathname === '/rest/v1/rpc/equip_frame') {
    const { p_frame, p_affiliation } = body() as { p_frame: string | null; p_affiliation: string | null };
    if (!userId) return (await err(401, '42501', 'permission denied for function equip_frame')), true;
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    if (p_frame === 'member' && !perksOf(userId).some((p) => p.key === p_affiliation)) return (await err(400, 'P0001', 'NO_SUCH_PERK')), true;
    if (p_frame && p_frame !== 'member' && !owns(userId, p_frame)) return (await err(400, 'P0001', 'NOT_OWNED')), true;
    db.appearance = (db.appearance ?? []).filter((r) => r.member_id !== userId);
    db.appearance.push({ member_id: userId, frame: p_frame, frame_affiliation: p_frame === 'member' ? p_affiliation : null });
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/card_appearances') {
    const out = db.published.flatMap((c) => {
      const v = validFrame(String(c.profile_id));
      return v ? [{ profile_id: c.profile_id, ...v }] : [];
    });
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/card_pins') {
    const out = db.published.flatMap((c) => {
      const pins = (db.memberAchievements ?? [])
        .filter((m) => m.member_id === c.profile_id)
        .map((m) => (db.customBadges ?? []).find((b) => b.key === m.key))
        .filter((b): b is Row => Boolean(b))
        .reverse()
        .slice(0, 3)
        .map((b) => ({ key: b.key, name: b.name, gem: b.gem, tone: b.tone }));
      return pins.length ? [{ profile_id: c.profile_id, pins }] : [];
    });
    return (await json(200, out)), true;
  }
  const REWARDS_ADMIN = ['admin_mart_items', 'admin_save_frame', 'admin_set_item_active', 'admin_save_badge', 'admin_grant_badge', 'admin_revoke_badge'];
  const rfn = url.pathname.replace('/rest/v1/rpc/', '');
  if (REWARDS_ADMIN.includes(rfn)) {
    if (!userId) return (await err(401, '42501', `permission denied for function ${rfn}`)), true;
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as Record<string, unknown>;
    if (rfn === 'admin_mart_items') return (await json(200, allItems())), true;
    if (rfn === 'admin_save_frame') {
      if (MART_ITEMS.some((m) => m.key === b.p_key)) return (await err(400, 'P0001', 'BUILT_IN')), true;
      db.customItems = (db.customItems ?? []).filter((m) => m.key !== b.p_key);
      db.customItems.push({ key: b.p_key, kind: 'frame', name: b.p_name, description: b.p_description, price: b.p_price, for_sale: b.p_for_sale, active: true, style: b.p_style, sort: 100 });
      return (await json(200, null)), true;
    }
    if (rfn === 'admin_set_item_active') {
      const m = (db.customItems ?? []).find((x) => x.key === b.p_key);
      if (!m) return (await err(400, 'P0001', 'NO_SUCH_ITEM')), true;
      m.active = b.p_active;
      return (await json(200, null)), true;
    }
    if (rfn === 'admin_save_badge') {
      if (ACHIEVEMENTS.some((a) => a.key === b.p_key)) return (await err(400, 'P0001', 'BUILT_IN')), true;
      db.customBadges = (db.customBadges ?? []).filter((x) => x.key !== b.p_key);
      db.customBadges.push({ key: b.p_key, name: b.p_name, description: b.p_description, reward: b.p_reward, sort: 100, custom: true, gem: b.p_gem, tone: b.p_tone, reward_frame: b.p_frame });
      return (await json(200, null)), true;
    }
    const badge = (db.customBadges ?? []).find((x) => x.key === b.p_key);
    if (rfn === 'admin_grant_badge') {
      if (!badge) return (await err(400, 'P0001', 'NO_SUCH_BADGE')), true;
      const member = String(b.p_member);
      if (!inHall(member)) return (await err(400, 'P0001', 'NOT_PUBLISHED')), true;
      db.memberAchievements ??= [];
      if (db.memberAchievements.some((m) => m.member_id === member && m.key === badge.key)) return (await json(200, false)), true;
      db.memberAchievements.push({ member_id: member, key: badge.key });
      if (Number(badge.reward) > 0) grant(db, member, Number(badge.reward), 'achievement', `achievement:${String(badge.key)}`);
      if (badge.reward_frame && !owns(member, String(badge.reward_frame))) (db.inventory ??= []).push({ member_id: member, item_key: badge.reward_frame });
      return (await json(200, true)), true;
    }
    if (rfn === 'admin_revoke_badge') {
      const before = (db.memberAchievements ?? []).length;
      db.memberAchievements = (db.memberAchievements ?? []).filter((m) => !(badge && m.member_id === b.p_member && m.key === badge.key));
      return (await json(200, db.memberAchievements.length < before)), true;
    }
  }
  if (url.pathname === '/rest/v1/rpc/admin_set_affiliation_frame') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_key, p_frame } = body() as { p_key: string; p_frame: string | null };
    const a = (db.affiliations ?? []).find((r) => r.key === p_key);
    if (a) a.frame_key = p_frame;
    return (await json(200, null)), true;
  }

  // ---- Project collaborators (D-089)
  const COLLAB = ['my_collaborations', 'tag_collaborator', 'untag_collaborator', 'respond_collaboration', 'leave_collaboration'];
  const cfn = url.pathname.replace('/rest/v1/rpc/', '');
  if (COLLAB.includes(cfn)) {
    if (!userId) return (await err(401, '42501', `permission denied for function ${cfn}`)), true;
    const b = body() as Record<string, unknown>;
    db.collabs ??= [];
    const ownsProject = (pid: unknown) => db.projects.some((p) => p.id === pid && p.profile_id === userId);
    if (cfn === 'my_collaborations') {
      const incoming = db.collabs
        .filter((r) => r.member_id === userId && r.status !== 'declined')
        .map((r) => {
          const pr = db.projects.find((p) => p.id === r.project_id)!;
          const owner = db.profiles.find((p) => p.id === pr.profile_id)!;
          return { project_id: r.project_id, title: pr.title, owner_username: owner.username, owner_name: owner.full_name, status: r.status };
        });
      const outgoing = db.collabs
        .filter((r) => ownsProject(r.project_id))
        .map((r) => {
          const c = db.published.find((x) => x.profile_id === r.member_id);
          return { project_id: r.project_id, member_id: r.member_id, username: c?.username ?? null, full_name: (c?.card as Row | undefined)?.full_name ?? null, status: r.status };
        });
      return (await json(200, { incoming, outgoing })), true;
    }
    if (cfn === 'tag_collaborator') {
      if (!ownsProject(b.p_project)) return (await err(400, 'P0001', 'NOT_YOURS')), true;
      const who = db.published.find((c) => c.username === String(b.p_username ?? '').trim().toLowerCase());
      if (!who) return (await err(400, 'P0001', 'NOT_IN_HALL')), true;
      if (who.profile_id === userId) return (await err(400, 'P0001', 'SELF')), true;
      const existing = db.collabs.find((r) => r.project_id === b.p_project && r.member_id === who.profile_id);
      if (existing?.status === 'declined') return (await err(400, 'P0001', 'DECLINED')), true;
      if (!existing) {
        if (db.collabs.filter((r) => r.project_id === b.p_project).length >= 8) return (await err(400, 'P0001', 'TOO_MANY')), true;
        db.collabs.push({ project_id: b.p_project, member_id: who.profile_id, status: 'pending' });
      }
      return (await json(200, { member_id: who.profile_id, username: who.username, full_name: (who.card as Row).full_name, status: existing?.status ?? 'pending' })), true;
    }
    if (cfn === 'untag_collaborator') {
      if (!ownsProject(b.p_project)) return (await err(400, 'P0001', 'NOT_YOURS')), true;
      db.collabs = db.collabs.filter((r) => !(r.project_id === b.p_project && r.member_id === b.p_member && r.status !== 'declined'));
      return (await json(200, null)), true;
    }
    const mineRow = db.collabs.find((r) => r.project_id === b.p_project && r.member_id === userId);
    if (cfn === 'respond_collaboration') {
      if (mineRow?.status !== 'pending') return (await err(400, 'P0001', 'NO_REQUEST')), true;
      mineRow.status = b.p_accept ? 'accepted' : 'declined';
      return (await json(200, null)), true;
    }
    if (cfn === 'leave_collaboration') {
      if (mineRow?.status !== 'accepted') return (await err(400, 'P0001', 'NO_REQUEST')), true;
      mineRow.status = 'declined';
      return (await json(200, null)), true;
    }
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
