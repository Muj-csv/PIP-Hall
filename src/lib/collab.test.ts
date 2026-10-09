import { describe, expect, it } from 'vitest';
import type { PublicCard } from '../types/card';
import type { Exhibit } from '../types/museum';
import { collaborationsOf, connectedProjects, creditLine, makersOf } from './collab';

const card = (username: string, projects: PublicCard['card']['projects'] = []): PublicCard =>
  ({ profile_id: username, username, no: 1, published_at: '2026-10-06', card: { username, full_name: username.toUpperCase(), projects } }) as unknown as PublicCard;
const project = (title: string, collab: string[]) => ({ title, collaborators: collab.map((u, i) => ({ username: u, full_name: u, member_no: i + 2 })) }) as unknown as PublicCard['card']['projects'][number];

describe('collaborators', () => {
  const tide = project('Tide', ['bee', 'gone', 'ada']);
  const cards = [card('ada', [tide]), card('bee'), card('cy', [project('Kite', ['bee'])])];

  it('puts the owner first, then collaborators still in the hall', () => {
    expect(makersOf('ada', tide, cards).map((c) => c.username)).toEqual(['ada', 'bee']);
  });

  it('finds the projects a member is credited on, with their owners', () => {
    expect(collaborationsOf('bee', cards).map((x) => `${x.project.title}@${x.owner.username}`)).toEqual(['Tide@ada', 'Kite@cy']);
    expect(collaborationsOf('ada', cards)).toEqual([]);
  });

  it('writes a credit line', () => {
    expect(creditLine([])).toBe('');
    expect(creditLine(['Ada'])).toBe('Ada');
    expect(creditLine(['Ada', 'Bee'])).toBe('Ada and Bee');
    expect(creditLine(['Ada', 'Bee', 'Cy'])).toBe('Ada, Bee and Cy');
  });
});

describe('connected projects (V2-13)', () => {
  const ex = (id: string, username: string, title: string, collab: string[] = [], archive?: Exhibit['archive']): Exhibit =>
    ({ project_id: id, username, full_name: username.toUpperCase(), avatar_path: null, member_no: 1, project: { title, collaborators: collab.map((u) => ({ username: u, full_name: u.toUpperCase(), member_no: 2 })) }, archive }) as unknown as Exhibit;
  const old = { makers: [{ username: 'bee', full_name: 'BEE' }, { full_name: 'Someone' }] } as unknown as Exhibit['archive'];
  const all = [ex('k', 'ada', 'Kite', ['bee']), ex('t', 'bee', 'Tide'), ex('r', 'cy', 'Raft', ['ada', 'bee']), ex('z', '', 'Zeppelin', [], old), ex('q', 'dee', 'Quiet')];

  it('lists other projects that share a maker, with who connects them, most shared first', () => {
    expect(connectedProjects(all[0]!, all).map((c) => `${c.exhibit.project.title}:${c.via.map((v) => v.username).join('+')}`)).toEqual(['Raft:ada+bee', 'Tide:bee', 'Zeppelin:bee']);
    expect(connectedProjects(all[4]!, all)).toEqual([]);
  });

  it('links archive makers only when they are members', () => {
    expect(connectedProjects(all[3]!, all).map((c) => c.exhibit.project.title)).toEqual(['Kite', 'Raft', 'Tide']);
  });
});

