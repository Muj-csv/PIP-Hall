// A tiny in-memory stand-in for the database, enough to drive the editor and the admin queue end
// to end. It mimics the rules they depend on (supabase/migrations): members see only their own
// drafts and admins see all; editing a non-draft card sends it back to draft, any project write
// does too; submit needs a draft; max 6 projects; moderation functions refuse non-admins.
import { missionKey, missionMet, missionPeriod, type MissionKind, type MissionScope } from '../src/lib/missions';
import type { PublicCard } from '../src/types/card';
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
  /** Missions members claimed (V2-3). */
  missionCompletions?: Row[];
  /** Exhibits stamped in members' Passports (V2-2). */
  passportVisits?: Row[];
  memberAchievements?: Row[];
  /** MUSEUM and affiliations (mirrors supabase/migrations/*_museum.sql). */
  affiliations?: Row[];
  memberAffiliations?: Row[];
  museumEntries?: Row[];
  /** Paths uploaded to the project-covers bucket (screen pictures, D-092). */
  coverUploads?: string[];
  /** PIP MART (mirrors supabase/migrations/*_pip_mart.sql). */
  inventory?: Row[];
  appearance?: Row[];
  /** Borders and badges designed in Admin → Rewards (D-087). */
  customItems?: Row[];
  customBadges?: Row[];
  /** V2-4 (D-100): hall events addressed to members ({recipient, ...my_notifications item}), each
   *  member's read marker, and the public "Recent in the hall" lines. Left undefined, the functions
   *  answer as if the V2-4 database update hasn't run yet (PGRST202). */
  notifications?: Row[];
  notificationSeen?: Record<string, string>;
  recentEvents?: Row[];
  /** Project collaborators (D-089): {project_id, member_id, status}. */
  collabs?: Row[];
  /** V2-5 (D-101): the identity update has run (plates, titles, rerolls); `earned` holds each
   *  member's earned title keys (the database works them out; tests set them). */
  identity?: boolean;
  earned?: Record<string, string[]>;
  rerolls?: Row[];
  /** V2-6 (D-102): Museum wings ({key, kind, name, note, tags, sort, active}). Left undefined,
   *  museum_wings() answers as if the wings update hasn't run yet (PGRST202). */
  wings?: Row[];
  /** V2-7 (D-103): scheduled events ({key, name, blurb, starts_on, ends_on, mission, frame,
   *  counts}). Left undefined, current_season() answers as if the events update hasn't run.
   *  V2-9 (D-115) adds {kind, tracks, submissions_close, results_at, announced_at}. */
  seasons?: Row[];
  /** V2-9 (D-115, D-116): entries {season_key, project_id, member_id, track, submitted_at} and
   *  awards {id, season_key, project_id, place, name, track, note}. */
  submissions?: Row[];
  awards?: Row[];
  /** V2-10 (D-118): archive exhibits as stored ({id, title, …, makers: [{id, member_id, name}],
   *  published}) and members' claims ({id, exhibit_id, member_id, note, status}). Left undefined,
   *  museum_archive() answers as if the archive update hasn't run. */
  archive?: Row[];
  archiveClaims?: Row[];
}

/** The wings the wings migration seeds (no notes: the curators write those). */
export const SEED_WINGS: Row[] = [
  { key: 'featured', kind: 'featured', name: 'Featured Wing', note: '', tags: [], sort: 0, active: true },
  { key: 'collab', kind: 'collab', name: 'Collab Wing', note: '', tags: [], sort: 1, active: true },
  { key: 'officers', kind: 'officers', name: "Officers' Wing", note: '', tags: [], sort: 2, active: true },
  { key: 'web', kind: 'tags', name: 'Web Wing', note: '', tags: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue', 'Svelte', 'Next.js', 'PWA', 'Node.js'], sort: 10, active: true },
  { key: 'games', kind: 'tags', name: 'Games Wing', note: '', tags: ['Unity', 'Godot', 'C#', 'Phaser', 'Pygame', 'Game', 'Lua', 'GDScript'], sort: 11, active: true },
  { key: 'data', kind: 'tags', name: 'Data Wing', note: '', tags: ['Python', 'SQL', 'Postgres', 'Pandas', 'Jupyter', 'R', 'Machine Learning', 'Data'], sort: 12, active: true },
];

export const MART_ITEMS = [
  { key: 'meadow', kind: 'frame', name: 'Meadow Frame', description: 'Hill green with little flowers in bloom.', price: 200, sort: 1 },
  { key: 'dusk', kind: 'frame', name: 'Dusk Frame', description: 'Deep plum with stars in the corners.', price: 400, sort: 2 },
  { key: 'pearl', kind: 'frame', name: 'Pearl Frame', description: 'Soft cream with polished pearls.', price: 700, sort: 3 },
  { key: 'gold', kind: 'frame', name: 'Gold Frame', description: "Block gold with coins. For the hall's finest.", price: 1000, sort: 4 },
];

export const PLATE_ITEMS = [
  { key: 'plate-brass', kind: 'plate', name: 'Brass Plate', description: 'Your title on polished brass.', price: 150, sort: 50, style: { plate: 'gold', ink: 'ink' } },
  { key: 'plate-silver', kind: 'plate', name: 'Silver Plate', description: 'Your title on bright silver.', price: 300, sort: 51, style: { plate: 'metal-hi', ink: 'ink' } },
  { key: 'plate-plum', kind: 'plate', name: 'Plum Enamel Plate', description: 'Your title in cream on plum enamel.', price: 450, sort: 52, style: { plate: 'plum', ink: 'cream' } },
];
const TITLE_KEYS = ['card_holder', 'pioneer', 'explorer', 'connector', 'curator', 'pathfinder', 'champion'];

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
  const found = (db.discoveries ?? []).filter((r) => r.member_id === member && r.source !== 'imported').length; // D-098
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
  // V2-10: an archive exhibit's event as people say it, and crediting a linked member once.
  const arcLabel = (a: Row): string | null => {
    const n = (a.season_key ? ((db.seasons ?? []).find((x) => x.key === a.season_key)?.name as string | undefined) : undefined) ?? (a.event_name as string | null) ?? null;
    return n === null ? null : n.includes(String(a.year)) ? n : `${n} ${a.year}`;
  };
  const arcCredit = (a: Row, memberId: string) => {
    (a.credited as string[] | undefined) ??= [];
    if ((a.credited as string[]).includes(memberId) || !inHall(memberId)) return;
    (a.credited as string[]).push(memberId);
    const card = db.published.find((r) => r.profile_id === memberId)!;
    const at = new Date().toISOString();
    db.notifications?.push({ recipient: memberId, id: 600_000 + (db.notifications?.length ?? 0), type: 'ARCHIVE_CREDITED', at, target_type: 'archive', target_id: a.id, title: a.title, note: null, by_username: null, by_name: null });
    db.recentEvents?.unshift({ id: 650_000 + (db.recentEvents?.length ?? 0), type: 'ARCHIVE_CREDITED', at, username: card.username, full_name: (card.card as Row).full_name, title: a.title, project_id: a.id, with_username: null, with_name: null, event_key: null, event: null });
    for (const c of (db.archiveClaims ?? []).filter((x) => x.exhibit_id === a.id && x.member_id === memberId && x.status === 'pending')) c.status = 'confirmed';
    // The database works titles out from the records; the mock adds Champion for an archive win.
    if (db.identity && (a.award_place || a.award_name)) (db.earned ??= {})[memberId] = [...new Set([...(db.earned?.[memberId] ?? ['card_holder']), 'champion'])];
  };
  if (url.pathname === '/rest/v1/rpc/my_pips') return (await json(200, { eligible: inHall(userId), balance: balanceOf(db, userId) })), true;
  if (url.pathname === '/rest/v1/rpc/discover_card') {
    const card = String(body().p_card);
    const none = { granted: false, amount: 0, unlocked: [], balance: balanceOf(db, userId) };
    if (card === userId || !inHall(userId) || !inHall(card)) return (await json(200, none)), true;
    db.discoveries ??= [];
    if (db.discoveries.some((r) => r.member_id === userId && r.card_id === card)) return (await json(200, { ...none, new: false })), true;
    db.discoveries.push({ member_id: userId, card_id: card, created_at: new Date().toISOString(), source: 'verified' });
    const today = (db.ledger ?? []).filter((r) => r.member_id === userId && r.reason === 'discover').reduce((n, r) => n + Number(r.amount), 0);
    const paid = today + 5 <= 100 && grant(db, userId, 5, 'discover', `discover:${card}`);
    const unlocked = checkAchievements(db, userId);
    return (await json(200, { granted: paid, new: true, amount: paid ? 5 : 0, unlocked, balance: balanceOf(db, userId) })), true;
  }
  // Missions (V2-3, mirrors 20261006000600_missions_events.sql): same condition check as the app.
  if (url.pathname === '/rest/v1/rpc/my_missions') {
    const day = missionPeriod('daily').label;
    const week = missionPeriod('weekly').label;
    const done = (db.missionCompletions ?? []).filter((r) => r.member_id === userId && (r.period === day || r.period === week)).map((r) => ({ key: r.key }));
    const rerolls = (db.rerolls ?? []).filter((r) => r.member_id === userId && r.period === day).length;
    return (await json(200, { eligible: inHall(userId), day, week, done, ...(db.identity ? { rerolls } : {}) })), true;
  }
  if (url.pathname === '/rest/v1/rpc/complete_mission') {
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const { p_scope, p_kind, p_param, p_n } = body() as { p_scope: MissionScope; p_kind: MissionKind; p_param: string | null; p_n: number };
    const period = missionPeriod(p_scope);
    const key = missionKey(p_scope, period.label, p_kind, p_param, p_n);
    db.missionCompletions ??= [];
    if (db.missionCompletions.some((r) => r.member_id === userId && r.key === key)) return (await err(400, 'P0001', 'ALREADY_DONE')), true;
    if (db.missionCompletions.filter((r) => r.member_id === userId && r.scope === p_scope && r.period === period.label).length >= (p_scope === 'weekly' ? 1 : 3)) return (await err(400, 'P0001', 'MISSION_LIMIT')), true;
    const passport = {
      people: (db.discoveries ?? []).filter((r) => r.member_id === userId).map((r) => ({ id: String(r.card_id), at: String(r.created_at), imported: r.source === 'imported' })),
      exhibits: (db.passportVisits ?? []).filter((r) => r.member_id === userId).map((r) => ({ id: String(r.project_id), at: String(r.visited_at), imported: r.source === 'imported' })),
    };
    const cards = db.published.map((c) => ({ ...c, no: c.member_no })) as unknown as PublicCard[];
    if (!missionMet({ scope: p_scope, kind: p_kind, param: p_param, n: p_n, key, title: '', action: { random: true } }, passport, cards, period.starts)) return (await err(400, 'P0001', 'NOT_DONE')), true;
    db.missionCompletions.push({ member_id: userId, key, scope: p_scope, period: period.label });
    const amount = p_scope === 'weekly' ? 40 : 10;
    grant(db, userId, amount, 'mission', `mission:${key}`);
    return (await json(200, { key, amount, balance: balanceOf(db, userId) })), true;
  }
  // Passport (V2-2, mirrors 20261006000500_passport.sql)
  if (url.pathname === '/rest/v1/rpc/my_passport') {
    const at = (r: Row) => String(r.created_at ?? r.visited_at ?? new Date().toISOString());
    return (
      await json(200, {
        eligible: inHall(userId),
        people: (db.discoveries ?? []).filter((r) => r.member_id === userId).map((r) => ({ id: r.card_id, at: at(r), imported: r.source === 'imported' })),
        exhibits: (db.passportVisits ?? []).filter((r) => r.member_id === userId).map((r) => ({ id: r.project_id, at: at(r), imported: r.source === 'imported' })),
      })
    ), true;
  }
  if (url.pathname === '/rest/v1/rpc/stamp_exhibit') {
    const id = String(body().p_project);
    const onShow = (db.museumEntries ?? []).some((e) => e.project_id === id && e.member_id !== userId);
    db.passportVisits ??= [];
    if (!inHall(userId) || !onShow || db.passportVisits.some((r) => r.member_id === userId && r.project_id === id)) return (await json(200, false)), true;
    db.passportVisits.push({ member_id: userId, project_id: id, visited_at: new Date().toISOString(), source: 'verified' });
    return (await json(200, true)), true;
  }
  if (url.pathname === '/rest/v1/rpc/import_passport') {
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const { p_people, p_exhibits } = body() as { p_people: { id: string; at: string }[]; p_exhibits: { id: string; at: string }[] };
    db.discoveries ??= [];
    db.passportVisits ??= [];
    let people = 0;
    let exhibits = 0;
    for (const s of p_people) {
      if (s.id === userId || !inHall(s.id) || db.discoveries.some((r) => r.member_id === userId && r.card_id === s.id)) continue;
      db.discoveries.push({ member_id: userId, card_id: s.id, created_at: s.at, source: 'imported' });
      people++;
    }
    for (const s of p_exhibits) {
      if (!(db.museumEntries ?? []).some((e) => e.project_id === s.id && e.member_id !== userId) || db.passportVisits.some((r) => r.member_id === userId && r.project_id === s.id)) continue;
      db.passportVisits.push({ member_id: userId, project_id: s.id, visited_at: s.at, source: 'imported' });
      exhibits++;
    }
    return (await json(200, { people, exhibits })), true;
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
  // ---- V2-10b officers (mirrors 20261008000100_officers.sql).
  if (url.pathname === '/rest/v1/rpc/hall_officers') {
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const team = (m: Row) => (db.affiliations ?? []).find((x) => x.key === m.key && x.officers);
    const current = (a: Row) => !a.term_ends || String(a.term_ends) >= today;
    const out = (db.memberAffiliations ?? [])
      .filter((m) => team(m) && inHall(String(m.member_id)))
      .sort((x, y) => {
        const a = team(x)!;
        const b = team(y)!;
        return Number(current(b)) - Number(current(a)) || String(b.term_ends ?? '9999').localeCompare(String(a.term_ends ?? '9999')) || Number(a.sort) - Number(b.sort) || Number(x.seat ?? 100) - Number(y.seat ?? 100);
      })
      .map((m) => {
        const a = team(m)!;
        const c = db.published.find((r) => r.profile_id === m.member_id)!;
        return { profile_id: c.profile_id, username: c.username, full_name: (c.card as Row).full_name, position: m.position ?? null, seat: m.seat ?? 100, team: a.name, team_key: a.key, term_ends: a.term_ends ?? null, current: current(a) };
      });
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_set_officers' || url.pathname === '/rest/v1/rpc/admin_set_officer') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_key: string; p_officers?: boolean; p_term_ends?: string | null; p_member?: string; p_position?: string; p_seat?: number };
    const a = (db.affiliations ?? []).find((x) => x.key === b.p_key);
    if (!a) return (await err(400, 'P0001', 'NO_SUCH_AFFILIATION')), true;
    if (url.pathname.endsWith('admin_set_officers')) {
      Object.assign(a, { officers: Boolean(b.p_officers), term_ends: b.p_officers ? (b.p_term_ends ?? null) : null });
      return (await json(200, null)), true;
    }
    if (!a.officers) return (await err(400, 'P0001', 'NOT_OFFICERS')), true;
    const position = b.p_position?.trim() || null;
    if (position && (position.length < 2 || position.length > 40)) return (await err(400, 'P0001', 'BAD_POSITION')), true;
    if (!b.p_seat || b.p_seat < 1 || b.p_seat > 100) return (await err(400, 'P0001', 'BAD_SEAT')), true;
    if (!inHall(String(b.p_member))) return (await err(400, 'P0001', 'NOT_IN_HALL')), true;
    db.memberAffiliations ??= [];
    const row = db.memberAffiliations.find((m) => m.member_id === b.p_member && m.key === b.p_key);
    if (row) Object.assign(row, { position, seat: b.p_seat });
    else db.memberAffiliations.push({ member_id: b.p_member, key: b.p_key, position, seat: b.p_seat });
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
  // ---- V2-7 events (mirrors 20261006001000_seasons.sql). Dates are compared on the hall's calendar.
  const manilaToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const liveSeason = () => (db.seasons ?? []).find((x) => String(x.starts_on) <= manilaToday() && manilaToday() <= String(x.ends_on));
  // V2-9 (mirrors 20261007000000_hackathons.sql): an event's phase, its entries still on a card, its makers.
  const opensAt = (x: Row) => Date.parse(`${String(x.starts_on)}T00:00:00+08:00`);
  const kindOf = (x: Row) => String(x.kind ?? 'event');
  const phaseOf = (x: Row) => {
    const now = Date.now();
    if (now < opensAt(x)) return 'upcoming';
    if (kindOf(x) === 'event') return String(x.ends_on) >= manilaToday() ? 'live' : 'over';
    if (x.announced_at) return 'results';
    return now < Date.parse(String(x.submissions_close)) ? 'open' : 'judging';
  };
  const withPhase = (x: Row, counts: boolean) => ({
    kind: 'event', tracks: [], submissions_close: null, results_at: null, announced_at: null, ...x, phase: phaseOf(x),
    counts: counts ? { ...((x.counts as Row | undefined) ?? { joined: 0, projects: 0, exhibits: 0, teamups: 0 }), submissions: (db.submissions ?? []).filter((r) => r.season_key === x.key).length } : null,
  });
  const cardProject = (memberId: unknown, projectId: unknown) => {
    const c = db.published.find((r) => r.profile_id === memberId);
    return c ? { c, p: (((c.card as Row).projects as Row[] | undefined) ?? []).find((p) => p.id === projectId) } : null;
  };
  const entriesOf = (key: unknown) =>
    (db.submissions ?? [])
      .filter((r) => r.season_key === key)
      .flatMap((r) => {
        const at = cardProject(r.member_id, r.project_id);
        if (!at?.p) return [];
        const card = at.c.card as Row;
        return [{ project_id: r.project_id, username: at.c.username, full_name: card.full_name, avatar_path: card.avatar_path ?? null, member_no: at.c.member_no, featured: at.c.is_featured, console: null, track: r.track ?? null, project: at.p }];
      });
  const makersOf = (a: Row) => {
    const sub = (db.submissions ?? []).find((r) => r.season_key === a.season_key && r.project_id === a.project_id);
    const at = sub ? cardProject(sub.member_id, a.project_id) : null;
    if (!at?.p) return [];
    const credited = ((at.p.collaborators as Row[] | undefined) ?? []).flatMap((m) => db.published.filter((r) => r.username === m.username).map((r) => r.profile_id));
    return [...new Set([at.c.profile_id, ...credited])].map((id) => ({ id, title: at.p!.title }));
  };
  if (url.pathname === '/rest/v1/rpc/current_season') {
    if (!db.seasons) return (await err(404, 'PGRST202', 'Could not find the function public.current_season in the schema cache')), true;
    const live = liveSeason();
    const next = db.seasons.filter((x) => String(x.starts_on) > manilaToday()).sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)))[0];
    const results = db.seasons.filter((x) => x.announced_at && Date.now() - Date.parse(String(x.announced_at)) < 7 * 86400_000).sort((a, b) => String(b.announced_at).localeCompare(String(a.announced_at)))[0];
    return (await json(200, { live: live ? withPhase(live, true) : null, next: next ? withPhase(next, false) : null, results: results ? withPhase(results, false) : null })), true;
  }
  if (url.pathname === '/rest/v1/rpc/my_season') {
    const live = liveSeason();
    const mine = live ? (db.submissions ?? []).find((r) => r.season_key === live.key && r.member_id === userId) : undefined;
    return (await json(200, {
      eligible: inHall(userId),
      done: Boolean(live && (db.missionCompletions ?? []).some((r) => r.member_id === userId && r.key === `season:${live.key}`)),
      submission: mine ? { project_id: mine.project_id, track: mine.track ?? null } : null,
    })), true;
  }
  if (url.pathname === '/rest/v1/rpc/museum_events') {
    if (!db.seasons) return (await err(404, 'PGRST202', 'Could not find the function public.museum_events in the schema cache')), true;
    const out = db.seasons
      .filter((x) => kindOf(x) !== 'event' && Date.now() >= opensAt(x))
      .sort((a, b) => String(b.starts_on).localeCompare(String(a.starts_on)))
      .map((x) => ({
        ...withPhase(x, false),
        entries: entriesOf(x.key),
        awards: x.announced_at ? (db.awards ?? []).filter((a) => a.season_key === x.key).map(({ id, place, name, track, note, project_id }) => ({ id, place, name, track, note, project_id })) : [],
      }));
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/hall_awards') {
    if (!db.seasons && !db.archive) return (await err(404, 'PGRST202', 'Could not find the function public.hall_awards in the schema cache')), true;
    const by = new Map<unknown, Row[]>();
    for (const a of db.awards ?? []) {
      const ev = (db.seasons ?? []).find((x) => x.key === a.season_key);
      if (!ev?.announced_at) continue;
      for (const m of makersOf(a)) by.set(m.id, [...(by.get(m.id) ?? []), { event_key: ev.key, event: ev.name, place: a.place ?? null, name: a.name ?? null, track: a.track ?? null, project_id: a.project_id, title: m.title, at: ev.announced_at }]);
    }
    // V2-10: archive awards for the members linked on them.
    for (const a of (db.archive ?? []).filter((x) => x.published && (x.award_place || x.award_name)))
      for (const m of (a.makers as Row[]).filter((m) => m.member_id && inHall(String(m.member_id))))
        by.set(m.member_id, [...(by.get(m.member_id) ?? []), { event_key: a.season_key ?? null, event: arcLabel(a), place: a.award_place ?? null, name: a.award_name ?? null, track: a.award_in_track ? a.track : null, project_id: a.id, title: a.title, at: `${a.year}-12-31`, archive: true }]);
    return (await json(200, [...by].map(([profile_id, awards]) => ({ profile_id, awards })))), true;
  }
  if (url.pathname === '/rest/v1/rpc/submit_to_event' || url.pathname === '/rest/v1/rpc/withdraw_from_event') {
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const b = body() as { p_key: string; p_project?: string; p_track?: string | null };
    const ev = (db.seasons ?? []).find((x) => x.key === b.p_key && kindOf(x) !== 'event');
    if (!ev) return (await err(400, 'P0001', 'NO_SUCH_EVENT')), true;
    if (phaseOf(ev) !== 'open') return (await err(400, 'P0001', 'SUBMISSIONS_CLOSED')), true;
    db.submissions ??= [];
    const mine = db.submissions.find((r) => r.season_key === b.p_key && r.member_id === userId);
    if (url.pathname.endsWith('withdraw_from_event')) {
      if (!mine) return (await err(400, 'P0001', 'NOT_SUBMITTED')), true;
      db.submissions = db.submissions.filter((r) => r !== mine);
      return (await json(200, null)), true;
    }
    if (!cardProject(userId, b.p_project)?.p) return (await err(400, 'P0001', 'NOT_LIVE')), true;
    const tracks = (ev.tracks as string[] | undefined) ?? [];
    const t = b.p_track?.trim() || null;
    if ((tracks.length && (!t || !tracks.includes(t))) || (!tracks.length && t)) return (await err(400, 'P0001', 'BAD_TRACK')), true;
    if (mine && mine.project_id !== b.p_project) return (await err(400, 'P0001', 'ONE_PER_EVENT')), true;
    if (mine) mine.track = t;
    else db.submissions.push({ season_key: b.p_key, project_id: b.p_project, member_id: userId, track: t, submitted_at: new Date().toISOString() });
    return (await json(200, { project_id: b.p_project, track: t })), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_event_results') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_key } = body() as { p_key: string };
    const ev = (db.seasons ?? []).find((x) => x.key === p_key);
    const entries = (db.submissions ?? [])
      .filter((r) => r.season_key === p_key)
      .map((r) => {
        const at = cardProject(r.member_id, r.project_id);
        return { project_id: r.project_id, title: at?.p?.title ?? null, username: at?.c.username ?? '', full_name: (at?.c.card as Row | undefined)?.full_name ?? '', track: r.track ?? null, submitted_at: r.submitted_at, on_card: Boolean(at?.p) };
      });
    return (await json(200, { announced_at: ev?.announced_at ?? null, entries, awards: (db.awards ?? []).filter((a) => a.season_key === p_key) })), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_save_award') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_key: string; p_project: string; p_place: number | null; p_name: string | null; p_track: string | null; p_note: string };
    const ev = (db.seasons ?? []).find((x) => x.key === b.p_key);
    if (!ev) return (await err(400, 'P0001', 'NO_SUCH_EVENT')), true;
    if (ev.announced_at) return (await err(400, 'P0001', 'ALREADY_ANNOUNCED')), true;
    if (phaseOf(ev) !== 'judging') return (await err(400, 'P0001', 'STILL_OPEN')), true;
    const name = b.p_name?.trim() || null;
    if ((b.p_place == null) === (name == null)) return (await err(400, 'P0001', 'BAD_AWARD')), true;
    const sub = (db.submissions ?? []).find((r) => r.season_key === b.p_key && r.project_id === b.p_project);
    if (!sub) return (await err(400, 'P0001', 'NOT_SUBMITTED')), true;
    if (b.p_track && sub.track !== b.p_track) return (await err(400, 'P0001', 'BAD_TRACK')), true;
    db.awards ??= [];
    const same = (a: Row) => a.season_key === b.p_key && (a.track ?? null) === (b.p_track ?? null);
    if (db.awards.some((a) => same(a) && ((b.p_place != null && a.place === b.p_place) || (name && String(a.name ?? '').toLowerCase() === name.toLowerCase()) || (b.p_place != null && a.place != null && a.project_id === b.p_project))))
      return (await err(400, 'P0001', 'AWARD_TAKEN')), true;
    const id = (db.awards.reduce((m, a) => Math.max(m, Number(a.id)), 0) || 0) + 1;
    db.awards.push({ id, season_key: b.p_key, project_id: b.p_project, place: b.p_place, name, track: b.p_track || null, note: (b.p_note ?? '').trim() });
    return (await json(200, id)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_award_note' || url.pathname === '/rest/v1/rpc/admin_delete_award') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_id: number; p_note?: string };
    const a = (db.awards ?? []).find((x) => x.id === b.p_id);
    if (!a) return (await err(400, 'P0001', 'NO_SUCH_AWARD')), true;
    if (url.pathname.endsWith('admin_award_note')) a.note = (b.p_note ?? '').trim();
    else {
      if ((db.seasons ?? []).find((x) => x.key === a.season_key)?.announced_at) return (await err(400, 'P0001', 'ALREADY_ANNOUNCED')), true;
      db.awards = db.awards!.filter((x) => x !== a);
    }
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_announce_results') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_key } = body() as { p_key: string };
    const ev = (db.seasons ?? []).find((x) => x.key === p_key);
    if (!ev) return (await err(400, 'P0001', 'NO_SUCH_EVENT')), true;
    if (ev.announced_at) return (await err(400, 'P0001', 'ALREADY_ANNOUNCED')), true;
    if (phaseOf(ev) !== 'judging') return (await err(400, 'P0001', 'STILL_OPEN')), true;
    const won = (db.awards ?? []).filter((a) => a.season_key === p_key);
    if (!won.length) return (await err(400, 'P0001', 'NO_AWARDS')), true;
    ev.announced_at = new Date().toISOString();
    let makers = 0;
    let id = 900_000 + (db.notifications?.length ?? 0) * 10;
    db.recentEvents?.unshift({ id: ++id, type: 'RESULTS_ANNOUNCED', at: ev.announced_at, username: null, full_name: null, title: null, project_id: null, with_username: null, with_name: null, event_key: ev.key, event: ev.name });
    for (const a of won)
      for (const m of makersOf(a)) {
        makers++;
        db.notifications?.push({ recipient: m.id, id: ++id, type: 'AWARD_WON', at: ev.announced_at, target_type: 'project', target_id: a.project_id, title: m.title, note: null, event: ev.name, place: a.place ?? null, award: a.name ?? null, track: a.track ?? null, by_username: null, by_name: null });
        if (db.identity) (db.earned ??= {})[String(m.id)] = [...new Set([...(db.earned?.[String(m.id)] ?? ['card_holder']), 'champion'])];
      }
    return (await json(200, { announced_at: ev.announced_at, makers })), true;
  }
  if (url.pathname === '/rest/v1/rpc/complete_season_mission') {
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const live = liveSeason();
    const m = live?.mission as { kind: string; n: number; reward: number } | null | undefined;
    if (!live || !m) return (await err(400, 'P0001', 'NO_EVENT_MISSION')), true;
    const key = `season:${live.key}`;
    if ((db.missionCompletions ?? []).some((r) => r.member_id === userId && r.key === key)) return (await err(400, 'P0001', 'ALREADY_DONE')), true;
    // The mock checks "meet N people" from discoveries made since the event began (the real check is in SQL).
    const since = new Date(`${String(live.starts_on)}T00:00:00+08:00`).getTime();
    const met = (db.discoveries ?? []).filter((r) => r.member_id === userId && Date.parse(String(r.created_at)) >= since).length;
    if (m.kind !== 'people' || met < m.n) return (await err(400, 'P0001', 'NOT_DONE')), true;
    (db.missionCompletions ??= []).push({ member_id: userId, key, scope: 'season', period: live.key });
    grant(db, userId, m.reward, 'mission', `mission:${key}`);
    return (await json(200, { key, amount: m.reward, balance: balanceOf(db, userId) })), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_seasons') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const t = manilaToday();
    return (await json(200, (db.seasons ?? []).map((x) => ({
      ...withPhase(x, false), state: String(x.ends_on) < t ? 'over' : String(x.starts_on) > t ? 'upcoming' : 'live',
      entries: (db.submissions ?? []).filter((r) => r.season_key === x.key).length, award_count: (db.awards ?? []).filter((a) => a.season_key === x.key).length,
    })))), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_save_season') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_key: string; p_name: string; p_blurb: string; p_starts: string; p_ends: string; p_kind: string | null; p_param: string | null; p_n: number | null; p_reward: number | null; p_frame: string | null; p_event?: string; p_tracks?: string[]; p_close?: string | null; p_results?: string | null };
    if (!('p_event' in b)) return (await err(404, 'PGRST202', 'Could not find the function public.admin_save_season in the schema cache')), true;
    if (!b.p_starts || !b.p_ends || b.p_ends < b.p_starts) return (await err(400, 'P0001', 'BAD_DATES')), true;
    const ev = b.p_event ?? 'event';
    const tracks = ev === 'event' ? [] : (b.p_tracks ?? []).map((t) => t.trim()).filter(Boolean);
    if (tracks.length > 6 || tracks.some((t) => t.length < 2 || t.length > 30) || new Set(tracks.map((t) => t.toLowerCase())).size !== tracks.length) return (await err(400, 'P0001', 'BAD_TRACKS')), true;
    const from = Date.parse(`${b.p_starts}T00:00:00+08:00`);
    const to = Date.parse(`${b.p_ends}T00:00:00+08:00`) + 86400_000;
    const close = b.p_close ? Date.parse(b.p_close) : NaN;
    const results = b.p_results ? Date.parse(b.p_results) : NaN;
    if (ev !== 'event' && !(close > from && close <= to && results >= close && results <= to)) return (await err(400, 'P0001', 'BAD_SCHEDULE')), true;
    db.seasons ??= [];
    if (db.seasons.some((x) => x.key !== b.p_key && !(String(x.ends_on) < b.p_starts || String(x.starts_on) > b.p_ends))) return (await err(400, 'P0001', 'OVERLAP')), true;
    if (b.p_kind && (b.p_reward == null || b.p_reward < 5 || b.p_reward > 200)) return (await err(400, 'P0001', 'BAD_REWARD')), true;
    const frame = b.p_frame ? MART_ITEMS.find((m) => m.key === b.p_frame) ?? (db.customItems ?? []).find((m) => m.key === b.p_frame) : null;
    const next = {
      key: b.p_key, name: b.p_name, blurb: b.p_blurb, starts_on: b.p_starts, ends_on: b.p_ends,
      mission: b.p_kind ? { kind: b.p_kind, param: b.p_param, n: b.p_n ?? 1, reward: b.p_reward } : null,
      frame: frame ? { key: frame.key, name: frame.name, price: frame.price } : null,
      counts: { joined: 0, projects: 0, exhibits: 0, teamups: 0 },
      kind: ev, tracks, submissions_close: ev === 'event' ? null : b.p_close, results_at: ev === 'event' ? null : b.p_results,
    };
    const row = db.seasons.find((x) => x.key === b.p_key);
    if (row) Object.assign(row, next);
    else db.seasons.push(next);
    return (await json(200, null)), true;
  }

  // ---- V2-6 wings (mirrors 20261006000900_museum_wings.sql).
  const wingOrder = (a: Row, b: Row) => Number(a.sort) - Number(b.sort) || String(a.name).localeCompare(String(b.name));
  if (url.pathname === '/rest/v1/rpc/museum_wings') {
    if (!db.wings) return (await err(404, 'PGRST202', 'Could not find the function public.museum_wings in the schema cache')), true;
    return (await json(200, db.wings.filter((w) => w.active).sort(wingOrder).map(({ key, kind, name, note, tags }) => ({ key, kind, name, note, tags })))), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_wings') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    return (await json(200, [...(db.wings ?? [])].sort(wingOrder))), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_save_wing') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_key: string; p_name: string; p_note: string; p_tags: string[] | null; p_sort: number; p_active: boolean };
    if (!/^[a-z0-9][a-z0-9-]{1,23}$/.test(b.p_key)) return (await err(400, 'P0001', 'BAD_KEY')), true;
    if (b.p_name.trim().length < 2 || b.p_name.trim().length > 30) return (await err(400, 'P0001', 'BAD_NAME')), true;
    if ((b.p_note ?? '').trim().length > 280) return (await err(400, 'P0001', 'BAD_NOTE')), true;
    db.wings ??= [];
    const row = db.wings.find((w) => w.key === b.p_key);
    const kind = (row?.kind as string) ?? 'tags';
    const tags = kind === 'tags' ? [...new Map((b.p_tags ?? []).map((t) => t.trim()).filter(Boolean).map((t) => [t.toLowerCase(), t])).values()] : [];
    if (kind === 'tags' && (tags.length === 0 || tags.length > 12)) return (await err(400, 'P0001', 'BAD_TAGS')), true;
    const next = { key: b.p_key, kind, name: b.p_name.trim(), note: (b.p_note ?? '').trim(), tags, sort: b.p_sort ?? 100, active: b.p_active ?? true };
    if (row) Object.assign(row, next);
    else db.wings.push(next);
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_delete_wing') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_key } = body() as { p_key: string };
    const row = (db.wings ?? []).find((w) => w.key === p_key);
    if (row && row.kind !== 'tags') return (await err(400, 'P0001', 'BUILT_IN')), true;
    if (!row) return (await err(400, 'P0001', 'NO_SUCH_WING')), true;
    db.wings = db.wings!.filter((w) => w.key !== p_key);
    return (await json(200, null)), true;
  }

  // ---- V2-10 the archive (mirrors 20261008000000_archive.sql).
  if (url.pathname === '/rest/v1/rpc/museum_archive') {
    if (!db.archive) return (await err(404, 'PGRST202', 'Could not find the function public.museum_archive in the schema cache')), true;
    const out = db.archive
      .filter((a) => a.published)
      .sort((a, b) => Number(b.year) - Number(a.year) || String(a.title).localeCompare(String(b.title)))
      .map((a) => ({
        id: a.id, title: a.title, description: a.description ?? '', year: a.year,
        event_key: a.season_key ?? null, event: arcLabel(a), track: a.track ?? null,
        award: a.award_place || a.award_name ? { place: a.award_place ?? null, name: a.award_name ?? null, track: a.award_in_track ? a.track : null, note: a.award_note ?? '' } : null,
        team_name: a.team_name ?? null, tech: a.tech ?? [], project_url: a.project_url ?? null, github_url: a.github_url ?? null, video_url: a.video_url ?? null, cover_path: a.cover_path ?? null,
        makers: (a.makers as Row[]).flatMap((m): Row[] => {
          const c = m.member_id ? db.published.find((r) => r.profile_id === m.member_id) : undefined;
          if (c) return [{ username: c.username, full_name: (c.card as Row).full_name, member_no: c.member_no }];
          return a.names_ok && m.name ? [{ full_name: m.name }] : [];
        }),
        team_size: (a.makers as Row[]).length,
      }));
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/my_archive') {
    return (await json(200, {
      eligible: inHall(userId),
      claims: (db.archiveClaims ?? []).filter((c) => c.member_id === userId).map((c) => ({ exhibit_id: c.exhibit_id, status: c.status })),
      credited: (db.archive ?? []).filter((a) => (a.makers as Row[]).some((m) => m.member_id === userId)).map((a) => a.id),
    })), true;
  }
  if (url.pathname === '/rest/v1/rpc/claim_archive') {
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const b = body() as { p_id: string; p_note: string };
    const a = (db.archive ?? []).find((x) => x.id === b.p_id && x.published);
    if (!a) return (await err(400, 'P0001', 'NO_SUCH_EXHIBIT')), true;
    if ((a.makers as Row[]).some((m) => m.member_id === userId)) return (await err(400, 'P0001', 'ALREADY_CREDITED')), true;
    db.archiveClaims ??= [];
    const mine = db.archiveClaims.find((c) => c.exhibit_id === a.id && c.member_id === userId);
    if (mine?.status === 'pending') return (await err(400, 'P0001', 'ALREADY_CLAIMED')), true;
    if (mine) Object.assign(mine, { status: 'pending', note: (b.p_note ?? '').trim() });
    else db.archiveClaims.push({ id: db.archiveClaims.length + 1, exhibit_id: a.id, member_id: userId, note: (b.p_note ?? '').trim(), status: 'pending', at: new Date().toISOString() });
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/leave_archive') {
    const { p_id } = body() as { p_id: string };
    const slot = ((db.archive ?? []).find((x) => x.id === p_id)?.makers as Row[] | undefined)?.find((m) => m.member_id === userId);
    if (!slot) return (await err(400, 'P0001', 'NOT_CREDITED')), true;
    slot.member_id = null;
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_archive') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const out = (db.archive ?? []).map((a) => ({
      ...a,
      event: arcLabel(a),
      makers: (a.makers as Row[]).map((m) => {
        const c = m.member_id ? db.published.find((r) => r.profile_id === m.member_id) : undefined;
        return { ...m, username: c?.username ?? null, full_name: (c?.card as Row | undefined)?.full_name ?? null };
      }),
      claims: (db.archiveClaims ?? [])
        .filter((c) => c.exhibit_id === a.id && c.status === 'pending')
        .map((c) => {
          const card = db.published.find((r) => r.profile_id === c.member_id);
          return { id: c.id, member_id: c.member_id, username: card?.username ?? '', full_name: (card?.card as Row | undefined)?.full_name ?? '', note: c.note, at: c.at };
        }),
    }));
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_save_archive') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_id, p_data: d } = body() as { p_id: string | null; p_data: Row };
    if (!String(d.title ?? '').trim()) return (await err(400, 'P0001', 'BAD_TITLE')), true;
    if (!/^\d{4}$/.test(String(d.year ?? ''))) return (await err(400, 'P0001', 'BAD_YEAR')), true;
    if ((d.award_place || d.award_name) && !d.season_key && !d.event_name) return (await err(400, 'P0001', 'BAD_AWARD')), true;
    const makers = (d.makers as Row[]).map((m) => ({ member_id: m.member_id ?? null, name: m.name ?? null }));
    if (makers.some((m) => m.member_id && !inHall(String(m.member_id)))) return (await err(400, 'P0001', 'NOT_IN_HALL')), true;
    db.archive ??= [];
    let row = p_id ? db.archive.find((x) => x.id === p_id) : undefined;
    if (p_id && !row) return (await err(400, 'P0001', 'NO_SUCH_EXHIBIT')), true;
    let slot = db.archive.reduce((n, a) => n + (a.makers as Row[]).length, 0);
    const next = { ...d, year: Number(d.year), makers: makers.map((m) => ({ id: ++slot + 1000, ...m })) };
    if (row) Object.assign(row, next);
    else db.archive.push((row = { id: crypto.randomUUID(), first_published_at: null, ...next }));
    if (row.published) {
      if (!row.first_published_at) {
        row.first_published_at = new Date().toISOString();
        db.recentEvents?.unshift({ id: 800_000 + (db.recentEvents?.length ?? 0), type: 'ARCHIVE_ADDED', at: row.first_published_at, username: null, full_name: null, title: row.title, project_id: row.id, with_username: null, with_name: null, event_key: row.season_key ?? null, event: arcLabel(row) });
      }
      for (const m of row.makers as Row[]) if (m.member_id) arcCredit(row, String(m.member_id));
    }
    return (await json(200, row.id)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_delete_archive') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const { p_id } = body() as { p_id: string };
    if (!(db.archive ?? []).some((x) => x.id === p_id)) return (await err(400, 'P0001', 'NO_SUCH_EXHIBIT')), true;
    db.archive = db.archive!.filter((x) => x.id !== p_id);
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/admin_answer_claim') {
    if (!admin) return (await err(403, '42501', 'NOT_ADMIN')), true;
    const b = body() as { p_id: number; p_accept: boolean; p_maker: number | null; p_note: string };
    const c = (db.archiveClaims ?? []).find((x) => x.id === b.p_id && x.status === 'pending');
    if (!c) return (await err(400, 'P0001', 'NO_SUCH_CLAIM')), true;
    const a = db.archive!.find((x) => x.id === c.exhibit_id)!;
    if (!b.p_accept) {
      c.status = 'declined';
      db.notifications?.push({ recipient: c.member_id, id: 700_000 + Number(c.id), type: 'ARCHIVE_CLAIM_DECLINED', at: new Date().toISOString(), target_type: 'archive', target_id: a.id, title: a.title, note: b.p_note || null, by_username: null, by_name: null });
      return (await json(200, null)), true;
    }
    const makers = a.makers as Row[];
    if (!makers.some((m) => m.member_id === c.member_id)) {
      if (b.p_maker != null) {
        const slot = makers.find((m) => m.id === b.p_maker && !m.member_id);
        if (!slot) return (await err(400, 'P0001', 'BAD_MAKER')), true;
        slot.member_id = c.member_id;
      } else makers.push({ id: 5000 + makers.length, member_id: c.member_id, name: null });
    }
    c.status = 'confirmed';
    arcCredit(a, String(c.member_id));
    return (await json(200, null)), true;
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
  const allItems = (): Row[] => [
    ...MART_ITEMS.map((m) => ({ ...m, for_sale: true, active: true, style: null })),
    ...(db.identity ? PLATE_ITEMS.map((m) => ({ ...m, for_sale: true, active: true })) : []),
    ...(db.customItems ?? []),
  ];
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
  const frameInSeason = (key: string) => {
    const holders = (db.seasons ?? []).filter((x) => (x.frame as Row | null)?.key === key);
    return holders.length === 0 || holders.some((x) => x === liveSeason());
  };
  if (url.pathname === '/rest/v1/rpc/my_mart') {
    if (!userId) return (await err(401, '42501', 'permission denied for function my_mart')), true;
    const a = (db.appearance ?? []).find((r) => r.member_id === userId);
    return (await json(200, {
      eligible: inHall(userId),
      balance: balanceOf(db, userId),
      items: allItems()
        .filter((m) => (m.active && m.for_sale && frameInSeason(String(m.key))) || owns(userId, String(m.key)))
        .map((m) => ({ limited_until: (db.seasons ?? []).find((x) => (x.frame as Row | null)?.key === m.key && x === liveSeason())?.ends_on ?? null, key: m.key, kind: m.kind ?? 'frame', name: m.name, description: m.description, price: m.price, for_sale: m.for_sale, style: m.style, owned: owns(userId, String(m.key)) })),
      perks: perksOf(userId),
      equipped: { frame: a?.frame ?? null, affiliation: a?.frame_affiliation ?? null, title: a?.title ?? null, plate: a?.plate ?? null },
    })), true;
  }
  // ---- V2-5 titles and plates (mirrors 20261006000800_identity.sql).
  const notYetId = (name: string) => err(404, 'PGRST202', `Could not find the function public.${name} in the schema cache`);
  const earnedOf = (id: string) => (inHall(id) ? ['card_holder', ...(db.earned?.[id] ?? []).filter((k) => k !== 'card_holder')] : []).filter((k) => TITLE_KEYS.includes(k));
  const look = (id: string) => (db.appearance ?? []).find((r) => r.member_id === id);
  const setLook = (id: string, patch: Row) => {
    const row = look(id);
    if (row) Object.assign(row, patch);
    else (db.appearance ??= []).push({ member_id: id, frame: null, frame_affiliation: null, ...patch });
  };
  if (url.pathname === '/rest/v1/rpc/hall_titles') {
    if (!db.identity) return (await notYetId('hall_titles')), true;
    const out = db.published.map((c) => {
      const id = String(c.profile_id);
      const e = earnedOf(id);
      const a = look(id);
      const plate = PLATE_ITEMS.find((p) => p.key === a?.plate && owns(id, p.key));
      return { profile_id: id, earned: e, title: a?.title && e.includes(String(a.title)) ? a.title : null, plate_style: plate?.style ?? null };
    });
    return (await json(200, out)), true;
  }
  if (url.pathname === '/rest/v1/rpc/my_titles') {
    if (!db.identity) return (await notYetId('my_titles')), true;
    const e = earnedOf(userId);
    const a = look(userId);
    return (await json(200, {
      eligible: inHall(userId),
      title: a?.title && e.includes(String(a.title)) ? a.title : null,
      plate: a?.plate ?? null,
      titles: TITLE_KEYS.map((key) => ({ key, earned: e.includes(key) })),
    })), true;
  }
  if (url.pathname === '/rest/v1/rpc/equip_title') {
    const { p_title } = body() as { p_title: string | null };
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    if (p_title && !earnedOf(userId).includes(p_title)) return (await err(400, 'P0001', 'NOT_EARNED')), true;
    setLook(userId, { title: p_title });
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/equip_plate') {
    const { p_plate } = body() as { p_plate: string | null };
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    if (p_plate && !(PLATE_ITEMS.some((p) => p.key === p_plate) && owns(userId, p_plate))) return (await err(400, 'P0001', 'NOT_OWNED')), true;
    setLook(userId, { plate: p_plate });
    return (await json(200, null)), true;
  }
  if (url.pathname === '/rest/v1/rpc/reroll_missions') {
    if (!db.identity) return (await notYetId('reroll_missions')), true;
    if (!inHall(userId)) return (await err(400, 'P0001', 'NOT_ELIGIBLE')), true;
    const day = missionPeriod('daily').label;
    const used = (db.rerolls ?? []).filter((r) => r.member_id === userId && r.period === day).length;
    if (used >= 1) return (await err(400, 'P0001', 'REROLL_LIMIT')), true;
    const bal = balanceOf(db, userId);
    if (bal < 15) return (await err(400, 'P0001', 'NOT_ENOUGH_PIPS')), true;
    db.ledger ??= [];
    db.ledger.push({ id: db.ledger.length + 1, member_id: userId, amount: -15, reason: 'purchase', ref: `reroll:${day}:${used + 1}`, created_at: new Date().toISOString() });
    (db.rerolls ??= []).push({ member_id: userId, period: day });
    return (await json(200, { rerolls: used + 1, balance: bal - 15 })), true;
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

  const notYet = (name: string) => err(404, 'PGRST202', `Could not find the function public.${name} in the schema cache`);
  if (url.pathname === '/rest/v1/rpc/my_notifications') {
    if (!db.notifications) return (await notYet('my_notifications')), true;
    if (!userId) return (await err(401, '42501', 'permission denied for function my_notifications')), true;
    const items = db.notifications
      .filter((r) => r.recipient === userId)
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'recipient')));
    return (await json(200, { seen_at: db.notificationSeen?.[userId] ?? null, items })), true;
  }
  if (url.pathname === '/rest/v1/rpc/mark_notifications_seen') {
    if (!db.notifications) return (await notYet('mark_notifications_seen')), true;
    const at = new Date().toISOString();
    (db.notificationSeen ??= {})[userId] = at;
    return (await json(200, at)), true;
  }
  if (url.pathname === '/rest/v1/rpc/recent_hall_events') {
    if (!db.recentEvents) return (await notYet('recent_hall_events')), true;
    const limit = Math.max(1, Math.min(Number(body()?.p_limit ?? 8), 20));
    return (await json(200, db.recentEvents.slice(0, limit))), true;
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

  const upload = url.pathname.match(/^\/storage\/v1\/object\/(avatars|project-covers)\/(.+)$/);
  if (upload && method === 'POST') {
    const [, bucket, path] = upload as unknown as [string, string, string];
    if (!path.startsWith(`${userId}/`)) return (await err(403, '403', 'new row violates row-level security policy')), true;
    if (bucket === 'avatars') db.uploads.push(path);
    else (db.coverUploads ??= []).push(path);
    return (await json(200, { Key: `${bucket}/${path}`, Id: crypto.randomUUID() })), true;
  }

  return false;
}

/** A 2×2 PNG, enough for the browser to decode and re-encode as WebP. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==',
  'base64',
);
