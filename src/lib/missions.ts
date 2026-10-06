// Missions (V2-3, D-099): three a day and one a week, on the hall's calendar (Asia/Manila, like
// the PIP caps). They're picked from the date and REAL hall data (a skill Mission only names a
// skill someone in the hall lists), so the same hall gives everyone the same Missions. Progress
// comes from Passport stamps made in the current day or week. For members the database checks the
// same condition again before paying (complete_mission); for guests a Mission is a stamp only.

import type { PublicCard } from '../types/card';
import type { Exhibit } from '../types/museum';
import type { PassportData, Stamp } from './passport';
import { teamProjects } from './passport';

/** 'season' is an event's own Mission (V2-7, D-103): one per event, its reward set by the event. */
export type MissionScope = 'daily' | 'weekly' | 'season';
export type MissionKind = 'skill' | 'department' | 'tech' | 'team' | 'people' | 'exhibits' | 'departments';

export interface Mission {
  scope: MissionScope;
  kind: MissionKind;
  /** The skill, department or technology asked for. */
  param: string | null;
  n: number;
  key: string;
  title: string;
  /** What the "Go" button does: a search to run, or a place to go. */
  action: { search: { skill?: string; department?: string; q?: string } } | { to: '/museum' } | { random: true };
}

const ZONE_MS = 8 * 3600_000; // Asia/Manila is UTC+8, no daylight saving

/** The hall's calendar day and ISO week (same labels as mission_period() in SQL). */
export function missionPeriod(scope: MissionScope, now = new Date()): { label: string; starts: Date } {
  const local = new Date(now.getTime() + ZONE_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  if (scope === 'daily') {
    return { label: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, starts: new Date(Date.UTC(y, m, d) - ZONE_MS) };
  }
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(y, m, d - dow);
  const thursday = new Date(monday + 3 * 86400_000);
  const isoYear = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(isoYear, 0, 1)) / (7 * 86400_000)) + 1;
  return { label: `${isoYear}-W${String(week).padStart(2, '0')}`, starts: new Date(monday - ZONE_MS) };
}

export function missionKey(scope: MissionScope, label: string, kind: MissionKind, param: string | null, n: number): string {
  return `${scope}:${label}:${kind}:${(param ?? '').trim().toLowerCase()}:${n}`;
}

/** A small seeded random (mulberry32), so a day always picks the same Missions. */
function seeded(seed: string): () => number {
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (Math.imul(a ^ seed.charCodeAt(i), 2654435761) >>> 0) + 0x9e3779b9;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(list: readonly T[], r: () => number): T | undefined => list[Math.floor(r() * list.length)];
const uniq = (xs: string[]) => [...new Map(xs.filter((x) => x.trim()).map((x) => [x.trim().toLowerCase(), x.trim()])).values()].sort();

export function makeMission(scope: MissionScope, label: string, kind: MissionKind, param: string | null, n: number): Mission {
  const key = missionKey(scope, label, kind, param, n);
  switch (kind) {
    case 'skill':
      return { scope, kind, param, n, key, title: `Find someone who knows ${param}`, action: { search: { skill: param! } } };
    case 'department':
      return { scope, kind, param, n, key, title: `Meet someone from ${param}`, action: { search: { department: param! } } };
    case 'tech':
      return { scope, kind, param, n, key, title: `Pip heard someone here builds with ${param}. Find them!`, action: { search: { q: param! } } };
    case 'team':
      return { scope, kind, param, n, key, title: 'Find someone who builds in a team', action: { random: true } };
    case 'people':
      return { scope, kind, param, n, key, title: `Meet ${n} people you haven’t met`, action: { random: true } };
    case 'exhibits':
      return { scope, kind, param, n, key, title: `Visit ${n} exhibits in the Museum`, action: { to: '/museum' } };
    case 'departments':
      return { scope, kind, param, n, key, title: `Meet people from ${n} different departments`, action: { random: true } };
  }
}

/**
 * Today's Missions and this week's, from the hall as it is. A Mission is only offered when the
 * hall can really complete it (product rule 7). `me` (a member's profile id) is left out of the pool.
 */
export function pickMissions(
  day: string,
  week: string,
  cards: readonly PublicCard[],
  exhibits: readonly Exhibit[],
  me: string | null = null,
  /** A member's rerolls today (V2-5, D-101): each one seeds a fresh daily set. */
  rerolls = 0,
): { daily: Mission[]; weekly: Mission | null } {
  const others = cards.filter((c) => c.profile_id !== me);
  const meName = cards.find((c) => c.profile_id === me)?.username;
  const showing = exhibits.filter((e) => e.username !== meName).length;
  const skills = uniq(others.flatMap((c) => c.card.skills ?? []));
  const depts = uniq(others.map((c) => c.card.department ?? ''));
  const tech = uniq(others.flatMap((c) => c.card.projects.flatMap((p) => [p.language ?? '', ...p.tech_stack])));
  const teams = teamProjects(cards).some((t) => t.makers.some((m) => m.profile_id !== me));

  const r = seeded(rerolls > 0 ? `daily:${day}:r${rerolls}` : `daily:${day}`);
  const pool: Mission[] = [];
  if (skills.length) pool.push(makeMission('daily', day, 'skill', pick(skills, r)!, 1));
  if (depts.length) pool.push(makeMission('daily', day, 'department', pick(depts, r)!, 1));
  if (tech.length) pool.push(makeMission('daily', day, 'tech', pick(tech, r)!, 1));
  if (teams) pool.push(makeMission('daily', day, 'team', null, 1));
  if (others.length >= 3) pool.push(makeMission('daily', day, 'people', null, 3));
  if (showing >= 2) pool.push(makeMission('daily', day, 'exhibits', null, 2));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  const w = seeded(`weekly:${week}`);
  const weekly: Mission[] = [];
  if (others.length >= 8) weekly.push(makeMission('weekly', week, 'people', null, 8));
  if (showing >= 5) weekly.push(makeMission('weekly', week, 'exhibits', null, 5));
  if (depts.length >= 3) weekly.push(makeMission('weekly', week, 'departments', null, 3));
  return { daily: pool.slice(0, 3), weekly: pick(weekly, w) ?? null };
}

const same = (a: string | null | undefined, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** Is this Mission done, from stamps made since its day or week began (never imported ones)? */
export function missionMet(m: Mission, passport: PassportData, cards: readonly PublicCard[], since: Date): boolean {
  const fresh = (s: Stamp) => !s.imported && Date.parse(s.at) >= since.getTime();
  const byId = new Map(cards.map((c) => [c.profile_id, c]));
  const met = passport.people.filter(fresh).map((s) => byId.get(s.id)).filter((c): c is PublicCard => Boolean(c));
  switch (m.kind) {
    case 'people':
      return met.length >= m.n;
    case 'exhibits':
      return passport.exhibits.filter(fresh).length >= m.n;
    case 'skill':
      return met.some((c) => (c.card.skills ?? []).some((s) => same(s, m.param)));
    case 'department':
      return met.some((c) => same(c.card.department, m.param));
    case 'tech':
      return met.some((c) => c.card.projects.some((p) => same(p.language, m.param) || p.tech_stack.some((t) => same(t, m.param))));
    case 'team': {
      const inTeam = new Set(teamProjects(cards).flatMap((t) => t.makers.map((x) => x.profile_id)));
      return met.some((c) => inTeam.has(c.profile_id));
    }
    case 'departments':
      return new Set(met.map((c) => (c.card.department ?? '').trim().toLowerCase()).filter(Boolean)).size >= m.n;
  }
}

/** What a reroll costs a member, and how many a day (pip_rules() in SQL). */
export const REROLL = { price: 15, perDay: 1 } as const;

/** PIPs a Mission pays a member (pip_rules() in SQL). */
export const MISSION_PIPS: Readonly<Record<Exclude<MissionScope, 'season'>, number>> = { daily: 10, weekly: 40 };
