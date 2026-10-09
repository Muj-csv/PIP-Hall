// V2-13 (D-111, D-112, D-128): close the gaps. The things people already use answer one more
// question each: the Missions ask for a project made by 3 or more people and a winning exhibit;
// your Passport shows your own progress; a profile shows who they've made things with (and, after a
// badge scan, the related people Pip can walk to); an exhibit lists its connected projects.
// Supabase data source, mocked, PIPs on.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, rewardApproval, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const EVIDENCE = 'docs/build/evidence/gaps';
mkdirSync(EVIDENCE, { recursive: true });
const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ONE = '00000000-0000-4000-8000-000000000201';
const TWO = '00000000-0000-4000-8000-000000000202';
const RAFT = '22222222-0000-4000-8000-000000000001';
const COMET = '22222222-0000-4000-8000-000000000002';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

/** No skills, departments or tools, so today's Missions are exactly the ones this phase adds (and Team). */
function card(id: string, username: string, no: number, projects: Row[]): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: false,
    card: { ...base.card, skills: [], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, language: null, tech_stack: [], collaborators: [], ...p })) },
  };
}

/** Player 1 made Raft with player 2 and me, and Comet alone; Comet won 1st place at a past event. */
function hall(onShow: string[] = [COMET]): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ME.id, 'me-player', 1, []),
    card(ONE, 'player-1', 2, [
      { id: RAFT, title: 'Raft', description: 'A raft that floats on data.', collaborators: [{ username: 'player-2', full_name: 'Player player-2', member_no: 3 }, { username: 'me-player', full_name: 'Player me-player', member_no: 1 }] },
      { id: COMET, title: 'Comet', description: 'A comet tracker.' },
    ]),
    card(TWO, 'player-2', 3, []),
  );
  rewardApproval(db, ME.id);
  db.notifications = [];
  db.recentEvents = [];
  db.affiliations = [{ key: 'cs', name: 'CS', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [{ member_id: ONE, key: 'cs' }];
  db.museumFeatures = onShow.map((project_id) => ({ project_id, member_id: ONE }));
  db.seasons = [
    {
      key: 'spring-hack', name: 'Spring Hackathon', blurb: '', starts_on: day(-10), ends_on: day(-8), mission: null, frame: null,
      counts: null, kind: 'hackathon', tracks: [], submissions_close: ago(24 * 9), results_at: ago(24 * 8), announced_at: ago(24 * 8),
    },
  ];
  db.submissions = [{ season_key: 'spring-hack', project_id: COMET, member_id: ONE, track: null, submitted_at: ago(24 * 9.5) }];
  db.awards = [{ id: 1, season_key: 'spring-hack', project_id: COMET, place: 1, name: null, track: null, note: 'Bright idea.' }];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });

test('two new Missions: a project made by 3 or more people, and a winning exhibit; your progress counts them, privately', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ME, db });
  await page.goto('/');
  const today = page.getByRole('list', { name: 'Today’s Missions' });
  await expect(today).toContainText('Find a project made by 3 or more people');
  await expect(today).toContainText('Visit a winning exhibit');
  await expect(today.locator('a[href="/museum?room=winners"]')).toContainText('Go: Visit a winning exhibit'); // Go leads to the Winners' Hall

  // Meet one of Raft's makers, then claim.
  await page.goto('/member/player-2');
  await expect(page.locator('#profile-name')).toHaveText('Player player-2');
  await page.goto('/');
  await today.getByRole('button', { name: /Claim Find a project made by 3 or more people/ }).click();
  await expect.poll(() => (db.missionCompletions ?? []).map((m) => m.key)).toContainEqual(expect.stringMatching(/^daily:.*:crew::3$/));

  // Open the winning exhibit, then claim.
  await page.goto(`/museum/${COMET}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Comet');
  await expect.poll(() => (db.passportVisits ?? []).length).toBe(1);
  await page.goto('/');
  await today.getByRole('button', { name: /Claim Visit a winning exhibit/ }).click();
  await expect.poll(() => (db.missionCompletions ?? []).map((m) => m.key)).toContainEqual(expect.stringMatching(/^daily:.*:winner::1$/));
  await page.locator('.hall-tabs').screenshot({ path: `${EVIDENCE}/missions.png` });

  // Your progress, in your own Passport only.
  await page.goto('/passport');
  const progress = page.getByRole('region', { name: 'Your progress' });
  await expect(progress).toContainText('Only you see this.');
  await expect(progress).toContainText('2 Missions completed · 2 daily · 0 weekly');
  await expect(progress).toContainText(/\d+ of \d+ achievements/);
  await expect(progress.getByRole('list', { name: 'Achievements' })).toContainText('Card Holder');
  await progress.scrollIntoViewIfNeeded();
  await progress.screenshot({ path: `${EVIDENCE}/your-progress.png` });
  // …and never on the public profile.
  await page.goto('/member/me-player');
  await expect(page.getByText('Missions completed')).toHaveCount(0);
});

test('a guest’s progress is the Missions finished on this device', async ({ page }) => {
  await boot(page);
  await page.addInitScript(() => localStorage.setItem('piphall-missions-v1', JSON.stringify(['daily:2026-10-08:team::1'])));
  await mockSupabase(page, { db: hall() });
  await page.goto('/passport');
  await expect(page.getByRole('region', { name: 'Your progress' })).toContainText('1 Mission finished on this device.');
});

test('a profile shows who they’ve made things with; a badge scan offers the related people, and Pip walks there', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/member/player-1');
  const made = page.getByRole('region', { name: /Made with/ });
  await expect(made.getByRole('heading')).toHaveText('Made with · 2');
  const list = made.getByRole('list', { name: 'People Player has made things with' });
  await expect(list.getByRole('listitem')).toHaveText([/Player me-player · Raft/, /Player player-2 · Raft/]);
  await expect(made.locator('svg.made-with-map rect')).toHaveCount(3); // player 1 and the two they made Raft with
  await made.scrollIntoViewIfNeeded();
  await made.screenshot({ path: `${EVIDENCE}/made-with.png` });

  // From a badge's QR: "You found…", then the related people, each a Walk there.
  await page.goto('/member/player-1?via=qr');
  const related = page.getByRole('region', { name: 'Related people' });
  await expect(related).toContainText('Made Raft together');
  await page.locator('.profile-screen').screenshot({ path: `${EVIDENCE}/qr-related.png` });
  await related.getByRole('button', { name: 'Walk there to Player player-2' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.screen .dialogue .sr-only').first()).toContainText('Pip walks to Player Player-2.');
});

test('an exhibit lists its connected projects, with who connects them', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall([COMET, RAFT]) });
  await page.goto(`/museum/${COMET}`);
  const connected = page.getByRole('region', { name: 'Connected projects' });
  await expect(connected.getByRole('listitem')).toHaveText([/Raft · also made by Player player-1/]);
  await connected.getByRole('link', { name: 'Raft' }).click();
  await expect(page).toHaveURL(new RegExp(`/museum/${RAFT}$`));
  await expect(page.getByRole('region', { name: 'Connected projects' }).getByRole('listitem')).toHaveText([/Comet · also made by Player player-1/]);
  await page.getByRole('region', { name: 'Connected projects' }).screenshot({ path: `${EVIDENCE}/connected.png` });
});
