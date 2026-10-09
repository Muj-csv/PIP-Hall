import { describe, expect, it } from 'vitest';
import type { PublicCard, PublicProject } from '../types/card';
import { buildNetwork, connections, DENSITY, density, layout, lineage, madeWith, neighbours } from './network';

const project = (title: string, withUsers: string[] = []): PublicProject => ({
  id: title,
  title,
  description: null,
  cover_path: null,
  project_url: null,
  github_url: null,
  language: null,
  stars: null,
  tech_stack: [],
  source: 'manual',
  project_date: null,
  collaborators: withUsers.map((u, i) => ({ username: u, full_name: `Name ${u}`, member_no: 100 + i })),
});
let no = 0;
const card = (username: string, projects: PublicProject[] = [], skills: string[] = []): PublicCard => {
  no++;
  return {
    profile_id: `id-${username}`,
    username,
    member_no: no,
    no,
    is_featured: false,
    published_at: '2026-10-06T00:00:00Z',
    card: { username, full_name: `Name ${username}`, tagline: null, bio: null, role: null, org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, skills, theme: 'classic', is_featured: false, projects },
  };
};

describe('density (D-096)', () => {
  it('counts members with projects and distinct team-ups between members still in the hall', () => {
    const cards = [card('ada', [project('Kite', ['bo', 'gone']), project('Kite 2', ['bo'])]), card('bo', [project('Tide', ['ada'])]), card('cy')];
    expect(density(cards)).toEqual({ members: 2, teamups: 1, ready: false });
  });

  it('opens only when both thresholds are met', () => {
    const many = Array.from({ length: DENSITY.members }, (_, i) => card(`m${i}`, [project(`P${i}`, i < DENSITY.teamups ? [`m${i + 1}`] : [])]));
    expect(density(many)).toMatchObject({ members: 30, teamups: 10, ready: true });
    expect(density(many.slice(0, 29)).ready).toBe(false);
  });
});

describe('the map', () => {
  const cards = [card('ada', [project('Kite', ['bo'])], ['Rust', 'Go']), card('bo', [], ['rust']), card('cy', [project('Solo')], ['Go', 'Lua'])];
  const net = buildNetwork(cards);

  it('links people to what they made and to skills two or more share', () => {
    expect(net.nodes.filter((n) => n.kind === 'person')).toHaveLength(3);
    expect(net.nodes.filter((n) => n.kind === 'skill').map((n) => n.label)).toEqual(['Go', 'Rust']); // Lua is only cy's
    expect(net.edges.filter((e) => e.b === 'project:ada:Kite').map((e) => e.a)).toEqual(['person:ada', 'person:bo']);
    expect([...neighbours(net, 'person:bo')].sort()).toEqual(['person:bo', 'project:ada:Kite', 'skill:rust']);
  });

  it('lays it out the same way every time, inside the box', () => {
    const a = layout(net, 800, 600);
    expect(layout(net, 800, 600)).toEqual(a);
    expect(a.nodes.every((n) => n.x >= 40 && n.x <= 760 && n.y >= 40 && n.y <= 560)).toBe(true);
  });

  it('has a plain list for every member', () => {
    const list = connections(cards);
    expect(list.map((l) => l.card.username)).toEqual(['ada', 'bo', 'cy']);
    expect(list[0]!.madeWith.map((m) => [m.card.username, m.projects])).toEqual([['bo', ['Kite']]]);
    expect(list[1]!.madeWith.map((m) => m.card.username)).toEqual(['ada']);
    expect(list[2]!.sharedSkills).toEqual(['Go']);
  });

  it('connects projects through the people who made them', () => {
    const more = [...cards, card('dee', [project('Tide', ['ada'])])];
    const l = lineage(more);
    const kite = l.find((x) => x.project.title === 'Kite')!;
    expect(kite.related.map((r) => [r.project.title, r.via.map((v) => v.username)])).toEqual([['Tide', ['ada']]]);
    expect(l.some((x) => x.project.title === 'Solo')).toBe(false);
  });
});

describe('made with, on one profile (V2-13)', () => {
  it('lists who a member made things with, credited on approved cards or both named in the archive, most shared first', () => {
    const cards = [card('wa', [project('Kite', ['wb', 'gone']), project('Raft', ['wb', 'wc'])]), card('wb'), card('wc'), card('wd')];
    const archive = [{ title: 'Old Lamp', makers: [{ username: 'wd' }, { username: 'wa' }, { username: null }] }];
    const links = madeWith('wa', cards, archive);
    expect(links.map((l) => `${l.card.username}:${l.projects.join('+')}`)).toEqual(['wb:Kite+Raft', 'wc:Raft', 'wd:Old Lamp']);
    expect(madeWith('wc', cards).map((l) => l.card.username)).toEqual(['wa', 'wb']); // credited together on Raft
    expect(madeWith('wd', cards)).toEqual([]); // the archive only when it's passed
    expect(madeWith('nobody', cards, archive)).toEqual([]);
  });
});

