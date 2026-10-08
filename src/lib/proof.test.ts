import { describe, expect, it } from 'vitest';
import type { PublicCard, PublicProject } from '../types/card';
import { githubOwner, proofOf } from './proof';

const project = (over: Partial<PublicProject>): PublicProject => ({
  title: 'P',
  description: null,
  cover_path: null,
  project_url: null,
  github_url: null,
  language: null,
  stars: null,
  tech_stack: [],
  source: 'manual',
  project_date: null,
  ...over,
});

const card = (username: string, over: Partial<PublicCard['card']> = {}): PublicCard => ({
  profile_id: `id-${username}`,
  username,
  member_no: 1,
  no: 1,
  is_featured: false,
  published_at: '2026-10-06T08:00:00Z',
  card: {
    username,
    full_name: `Name ${username}`,
    tagline: null,
    bio: null,
    role: null,
    org_position: null,
    department: null,
    avatar_path: null,
    github_username: null,
    linkedin_url: null,
    portfolio_url: null,
    public_email: null,
    skills: [],
    theme: 'classic',
    is_featured: false,
    projects: [],
    ...over,
  },
});

describe('githubOwner', () => {
  it('reads the owner of a github.com link only', () => {
    expect(githubOwner('https://github.com/Ada/kite')).toBe('ada');
    expect(githubOwner('https://gitlab.com/ada/kite')).toBeNull();
    expect(githubOwner('not a url')).toBeNull();
    expect(githubOwner(null)).toBeNull();
  });
});

describe('proofOf', () => {
  it('says what is verified and what is self-listed', () => {
    const ada = card('ada', {
      github_username: 'Ada',
      skills: ['Rust'],
      projects: [
        project({ title: 'Kite', source: 'github', github_url: 'https://github.com/ada/kite' }),
        project({ title: 'Fork', source: 'github', github_url: 'https://github.com/someone/fork' }),
        project({ title: 'Zine' }),
      ],
    });
    const lines = proofOf(ada, [ada], { earned: ['card_holder', 'pioneer'], title: null, plateStyle: null }).map((l) => `${l.mark} ${l.text}`);
    expect(lines).toEqual([
      '✓ GitHub verified: @Ada',
      '✓ Quest Log: 1 on their verified GitHub, 1 from another GitHub account and 1 added by hand.',
      '· Skills (self-listed): Rust.',
      '✓ Card approved 6 Oct 2026.',
      '★ Card Holder: Has a card in the hall.',
      '★ Pioneer: One of the hall’s first 10 members.',
    ]);
  });

  it('lists team projects both ways, and says when there is no GitHub', () => {
    const bo = card('bo');
    const ada = card('ada', { projects: [project({ title: 'Kite', collaborators: [{ username: 'bo', full_name: 'Name bo', member_no: 2 }] })] });
    expect(proofOf(ada, [ada, bo], null).map((l) => l.text)).toContain('Team projects: “Kite” with Name bo.');
    expect(proofOf(bo, [ada, bo], null).map((l) => l.text)).toEqual(['No GitHub account linked.', 'Team projects: “Kite” with Name ada.', 'Card approved 6 Oct 2026.']);
    const won = proofOf(bo, [ada, bo], null, [
      { event_key: 'spring-hack', event: 'Spring Hackathon', place: 1, name: null, track: null, project_id: 'k', title: 'Kite', at: '2026-10-12T10:00:00Z' },
      { event_key: 'spring-hack', event: 'Spring Hackathon', place: null, name: 'Best UI', track: 'Health', project_id: 'k', title: 'Kite', at: '2026-10-12T10:00:00Z' },
    ]);
    expect(proofOf(bo, [ada, bo], null, [], [{ title: 'Kite', event: 'Spring Hackathon 2024', year: 2024 }]).map((l) => l.text)).toContain('Archive: credited on “Kite” (Spring Hackathon 2024).');
    const seats = proofOf(bo, [ada, bo], null, [], [], [
      { position: 'President', team: 'Officers 2026–27', current: true },
      { position: null, team: 'Officers 2025–26', current: false },
    ]).filter((l) => /fficer/.test(l.text));
    expect(seats.map((l) => `${l.mark} ${l.text}`)).toEqual(['✓ Officer: President, Officers 2026–27.', '· Past officer: Officers 2025–26.']);
    expect(won.filter((l) => l.mark === '★').map((l) => l.text)).toEqual([
      '1st place at Spring Hackathon with “Kite”.',
      'Best UI · Health track at Spring Hackathon with “Kite”.',
    ]);
  });
});
