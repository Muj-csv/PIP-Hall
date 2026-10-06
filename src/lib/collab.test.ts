import { describe, expect, it } from 'vitest';
import type { PublicCard } from '../types/card';
import { collaborationsOf, creditLine, makersOf } from './collab';

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
