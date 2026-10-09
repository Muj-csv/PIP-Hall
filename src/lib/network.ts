// The network and project lineage (V2-8, D-105). Everything here is worked out in the browser from
// the published cards (ADR-002, D-096): people, the projects they made (alone or together, as
// credited on approved cards), and the skills two or more of them share. No relationship is
// inferred beyond that: a line means a credit or a skill on a card.
//
// The map waits for density (D-096, product rule 12): it opens when the hall has enough members
// with projects and enough team-ups that a constellation looks alive rather than empty.

import type { PublicCard, PublicProject } from '../types/card';

export const DENSITY = { members: 30, teamups: 10 } as const;

export interface Density {
  /** Members whose approved card lists at least one project. */
  members: number;
  /** Distinct pairs of members credited together on a project (both still in the hall). */
  teamups: number;
  ready: boolean;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const norm = (s: string) => s.trim().toLowerCase();

/** The makers of a project as approved: its owner, then credited collaborators still in the hall. */
function makers(owner: PublicCard, project: PublicProject, inHall: ReadonlySet<string>): string[] {
  return [owner.username, ...(project.collaborators ?? []).map((c) => c.username).filter((u) => u !== owner.username && inHall.has(u))];
}

export function density(cards: readonly PublicCard[]): Density {
  const inHall = new Set(cards.map((c) => c.username));
  const pairs = new Set<string>();
  for (const c of cards) for (const p of c.card.projects) for (const m of makers(c, p, inHall).slice(1)) pairs.add(pairKey(c.username, m));
  const members = cards.filter((c) => c.card.projects.length > 0).length;
  return { members, teamups: pairs.size, ready: members >= DENSITY.members && pairs.size >= DENSITY.teamups };
}

export type NodeKind = 'person' | 'project' | 'skill';

export interface NetNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** person: the username; project: the owner's username (where it lives). */
  username?: string;
  x: number;
  y: number;
}

export interface NetEdge {
  a: string;
  b: string;
  kind: 'made' | 'skill';
}

export interface Network {
  nodes: NetNode[];
  edges: NetEdge[];
}

const projectId = (owner: string, p: PublicProject, i: number) => `project:${owner}:${p.id ?? i}`;

/** People, their projects, and skills shared by at least two people. Positions start at 0. */
export function buildNetwork(cards: readonly PublicCard[]): Network {
  const inHall = new Set(cards.map((c) => c.username));
  const nodes: NetNode[] = [];
  const edges: NetEdge[] = [];
  for (const c of cards) nodes.push({ id: `person:${c.username}`, kind: 'person', label: c.card.full_name, username: c.username, x: 0, y: 0 });
  for (const c of cards) {
    c.card.projects.forEach((p, i) => {
      const id = projectId(c.username, p, i);
      nodes.push({ id, kind: 'project', label: p.title, username: c.username, x: 0, y: 0 });
      for (const m of makers(c, p, inHall)) edges.push({ a: `person:${m}`, b: id, kind: 'made' });
    });
  }
  const bySkill = new Map<string, { label: string; people: Set<string> }>();
  for (const c of cards)
    for (const s of c.card.skills ?? []) {
      const k = norm(s);
      if (!k) continue;
      const entry = bySkill.get(k) ?? { label: s.trim(), people: new Set<string>() };
      entry.people.add(c.username);
      bySkill.set(k, entry);
    }
  for (const [k, { label, people }] of [...bySkill].sort(([a], [b]) => a.localeCompare(b))) {
    if (people.size < 2) continue;
    nodes.push({ id: `skill:${k}`, kind: 'skill', label, x: 0, y: 0 });
    for (const u of people) edges.push({ a: `person:${u}`, b: `skill:${k}`, kind: 'skill' });
  }
  return { nodes, edges };
}

/** A small seeded random, so the same hall always draws the same map. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Places the nodes with a plain spring layout (linked nodes pull together, every pair pushes apart),
 * run a fixed number of steps once, inside a `width`×`height` box with a margin. Deterministic.
 */
export function layout(net: Network, width: number, height: number, steps = 220): Network {
  const r = seeded(net.nodes.length * 7919 + net.edges.length);
  const margin = 40;
  const nodes = net.nodes.map((n) => ({ ...n, x: margin + r() * (width - 2 * margin), y: margin + r() * (height - 2 * margin) }));
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const links = net.edges.map((e) => [index.get(e.a)!, index.get(e.b)!] as const).filter(([a, b]) => a !== undefined && b !== undefined);
  const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.3;
  for (let step = 0; step < steps; step++) {
    const heat = (1 - step / steps) * k * 0.4 + 1;
    const dx = new Float64Array(nodes.length);
    const dy = new Float64Array(nodes.length);
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const x = nodes[i]!.x - nodes[j]!.x;
        const y = nodes[i]!.y - nodes[j]!.y;
        const d2 = Math.max(0.01, x * x + y * y);
        const f = (k * k) / d2;
        dx[i]! += x * f;
        dy[i]! += y * f;
        dx[j]! -= x * f;
        dy[j]! -= y * f;
      }
    for (const [a, b] of links) {
      const x = nodes[a]!.x - nodes[b]!.x;
      const y = nodes[a]!.y - nodes[b]!.y;
      const d = Math.max(0.01, Math.hypot(x, y));
      const f = d / k;
      dx[a]! -= x * f;
      dy[a]! -= y * f;
      dx[b]! += x * f;
      dy[b]! += y * f;
    }
    // A gentle pull toward the middle, so the edges of the box don't collect everything.
    nodes.forEach((n, i) => {
      dx[i]! -= (n.x - width / 2) * 0.2;
      dy[i]! -= (n.y - height / 2) * 0.2;
    });
    nodes.forEach((n, i) => {
      const len = Math.max(0.01, Math.hypot(dx[i]!, dy[i]!));
      const move = Math.min(len, heat);
      n.x = Math.min(width - margin, Math.max(margin, n.x + (dx[i]! / len) * move));
      n.y = Math.min(height - margin, Math.max(margin, n.y + (dy[i]! / len) * move));
    });
  }
  return { nodes: nodes.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y) })), edges: net.edges };
}

/** Who a node is linked to, by id (for highlighting). */
export function neighbours(net: Network, id: string): Set<string> {
  const out = new Set<string>([id]);
  for (const e of net.edges) {
    if (e.a === id) out.add(e.b);
    if (e.b === id) out.add(e.a);
  }
  return out;
}

export interface PersonLinks {
  card: PublicCard;
  /** People they've been credited with on a project, and on which. */
  madeWith: { card: PublicCard; projects: string[] }[];
  /** Skills they share with at least one other member. */
  sharedSkills: string[];
}

/** The plain-list version of the map: one entry per member, in member-number order. */
export function connections(cards: readonly PublicCard[]): PersonLinks[] {
  const inHall = new Set(cards.map((c) => c.username));
  const byName = new Map(cards.map((c) => [c.username, c]));
  const together = new Map<string, Map<string, string[]>>();
  const add = (a: string, b: string, title: string) => {
    const m = together.get(a) ?? new Map<string, string[]>();
    m.set(b, [...(m.get(b) ?? []), title]);
    together.set(a, m);
  };
  for (const c of cards)
    for (const p of c.card.projects) {
      const ms = makers(c, p, inHall);
      for (const a of ms) for (const b of ms) if (a !== b) add(a, b, p.title);
    }
  const skillCount = new Map<string, number>();
  for (const c of cards) for (const s of new Set((c.card.skills ?? []).map(norm))) skillCount.set(s, (skillCount.get(s) ?? 0) + 1);
  return [...cards]
    .sort((a, b) => a.member_no - b.member_no)
    .map((card) => ({
      card,
      madeWith: [...(together.get(card.username) ?? new Map<string, string[]>())]
        .map(([u, projects]) => ({ card: byName.get(u)!, projects: [...new Set(projects)] }))
        .sort((a, b) => a.card.member_no - b.card.member_no),
      sharedSkills: (card.card.skills ?? []).filter((s) => (skillCount.get(norm(s)) ?? 0) >= 2),
    }));
}

/** One member's own links (V2-13, #2): who they've made things with, and on which projects: a
 *  credit on an approved card, or both named on an archive exhibit. Evidence only (rule 5); most
 *  shared projects first. Always worked out, whatever the hall's density (the full map waits). */
export function madeWith(
  username: string,
  cards: readonly PublicCard[],
  archive: readonly { title: string; makers: readonly { username?: string | null }[] }[] = [],
): { card: PublicCard; projects: string[] }[] {
  const inHall = new Set(cards.map((c) => c.username));
  const byName = new Map(cards.map((c) => [c.username, c]));
  const out = new Map<string, Set<string>>();
  const add = (ms: readonly string[], title: string) => {
    if (!ms.includes(username)) return;
    for (const m of ms) if (m !== username) out.set(m, (out.get(m) ?? new Set()).add(title));
  };
  for (const c of cards) for (const p of c.card.projects) add(makers(c, p, inHall), p.title);
  for (const a of archive) add([...new Set(a.makers.map((m) => m.username ?? '').filter((u) => inHall.has(u)))], a.title);
  return [...out]
    .map(([u, titles]) => ({ card: byName.get(u)!, projects: [...titles] }))
    .sort((a, b) => b.projects.length - a.projects.length || a.card.member_no - b.card.member_no);
}

export interface Lineage {
  project: PublicProject;
  owner: PublicCard;
  /** Other projects that share at least one maker, and who. */
  related: { project: PublicProject; owner: PublicCard; via: PublicCard[] }[];
}

/** Project lineage: projects connected through the people who made them. Only projects with a link. */
export function lineage(cards: readonly PublicCard[]): Lineage[] {
  const inHall = new Set(cards.map((c) => c.username));
  const byName = new Map(cards.map((c) => [c.username, c]));
  const all = cards.flatMap((owner) => owner.card.projects.map((project) => ({ project, owner, makers: new Set(makers(owner, project, inHall)) })));
  return all
    .map((x) => ({
      project: x.project,
      owner: x.owner,
      related: all
        .filter((y) => y !== x)
        .map((y) => ({ project: y.project, owner: y.owner, via: [...x.makers].filter((m) => y.makers.has(m)).map((m) => byName.get(m)!) }))
        .filter((y) => y.via.length > 0),
    }))
    .filter((x) => x.related.length > 0);
}
