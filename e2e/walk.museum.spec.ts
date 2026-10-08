// V2-11 (D-119, D-125): the walkable Museum. Pip walks the rooms in order (the Winners' Hall, each
// event, each wing, All exhibits, The Archive); the plaque in front of Pip lights up with the judges'
// note, winners stand on pedestals, the address follows the room, OPEN visits an exhibit and Back
// returns to it, the map jumps to any room, makers walk you to their work, admins pick each wing's
// style, and the list view is one link away (first on very narrow screens). Supabase data, mocked.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, SEED_WINGS, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const ONE = '00000000-0000-4000-8000-000000000301';
const TWO = '00000000-0000-4000-8000-000000000302';
const THREE = '00000000-0000-4000-8000-000000000303';
const KITE = '44444444-0000-4000-8000-000000000001';
const LAMP = '44444444-0000-4000-8000-000000000002';
const ORBIT = '44444444-0000-4000-8000-000000000003';
const TIDE = '44444444-0000-4000-8000-000000000004';
const ROBOT = '44444444-0000-4000-8000-000000000005';
const day = (days: number) => new Date(Date.now() + 8 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const EVIDENCE = 'docs/build/evidence/walk';

function card(id: string, username: string, no: number, projects: Row[]): Row {
  const base = samples[0]!;
  const p0 = base.card.projects[0]!;
  return {
    ...base,
    profile_id: id,
    username,
    member_no: no,
    is_featured: false,
    card: { ...base.card, skills: [], department: null, username, full_name: `Player ${username}`, is_featured: false, projects: projects.map((p) => ({ ...p0, collaborators: [], tech_stack: [], ...p })) },
  };
}

/** A hall whose hackathon has announced its winners, with an archive winner and four wings in use. */
function hall(): MockDb {
  const db = emptyDb();
  db.published.push(
    card(ONE, 'player-1', 1, [
      { id: KITE, title: 'Kite', language: 'TypeScript', collaborators: [{ username: 'player-2', full_name: 'Player player-2', member_no: 2 }] },
      { id: LAMP, title: 'Lamp', language: 'Python' },
    ]),
    card(TWO, 'player-2', 2, [{ id: ORBIT, title: 'Orbit', language: 'Lua', tech_stack: ['Unity'] }]),
    card(THREE, 'player-3', 3, [{ id: TIDE, title: 'Tide', language: 'TypeScript' }]),
  );
  db.wings = SEED_WINGS.map((w) => ({ ...w }));
  db.affiliations = [{ key: 'cs', name: 'CS Student', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [ONE, TWO, THREE].map((member_id) => ({ member_id, key: 'cs' }));
  db.museumEntries = [
    { project_id: KITE, member_id: ONE },
    { project_id: LAMP, member_id: ONE },
    { project_id: ORBIT, member_id: TWO },
    { project_id: TIDE, member_id: THREE },
  ];
  db.seasons = [
    {
      key: 'spring-hack',
      name: 'Spring Hackathon',
      blurb: 'Build something useful in a weekend.',
      starts_on: day(-10),
      ends_on: day(-6),
      mission: null,
      frame: null,
      counts: null,
      kind: 'hackathon',
      tracks: ['Health', 'Education'],
      submissions_close: ago(24 * 8),
      results_at: ago(24 * 6),
      announced_at: ago(24 * 6),
    },
  ];
  db.submissions = [
    { season_key: 'spring-hack', project_id: KITE, member_id: ONE, track: 'Health', submitted_at: ago(24 * 9) },
    { season_key: 'spring-hack', project_id: ORBIT, member_id: TWO, track: 'Education', submitted_at: ago(24 * 9) },
  ];
  db.awards = [
    { id: 1, season_key: 'spring-hack', project_id: KITE, place: 1, name: null, track: null, note: 'A clear idea, beautifully shipped.' },
    { id: 2, season_key: 'spring-hack', project_id: ORBIT, place: null, name: 'Best UI', track: 'Education', note: 'Lovely to use.' },
  ];
  db.archive = [
    {
      id: ROBOT, title: 'Old Robot', description: 'A robot that waters plants.', year: 2023, season_key: null, event_name: 'Robot Fair', track: null,
      award_place: 2, award_name: null, award_in_track: false, award_note: 'It really works.', team_name: null, tech: ['C++'],
      project_url: null, github_url: null, video_url: null, cover_path: null, names_ok: true, published: true, first_published_at: '2026-10-01T00:00:00Z',
      makers: [{ id: 2001, member_id: null, name: 'Rosa Diaz' }],
    },
  ];
  db.archiveClaims = [];
  db.notifications = [];
  db.recentEvents = [];
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
const line = (page: Page) => page.locator('.walk-screen .dialogue .sr-only');
const hud = (page: Page) => page.locator('.walk-hud');
const screen = (page: Page) => page.getByRole('region', { name: /^The Museum\./ });

test('visitors walk the Museum: rooms in order, lit plaques, the map, makers, OPEN and Back', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');

  // The walk opens in the Winners' Hall: the winner stands on a pedestal, its plaque lit, with the note.
  await expect(page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: 'Walk the Museum' })).toHaveAttribute('aria-current', 'page');
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);
  await expect(line(page)).toHaveText('Winners’ Hall, 1 of 3: Kite, by Player player-1 with Player player-2. 1st place · Spring Hackathon. OPEN visits it.');
  const lit = page.locator('.walk-stop[data-lit]');
  await expect(lit).toContainText('Kite');
  await expect(lit).toContainText('A clear idea, beautifully shipped.');
  await expect(lit).toHaveAttribute('data-pedestal', 'true');
  await expect(page.locator('.walk-sign[data-kind="door"]').first()).toHaveText('Winners’ Hall');
  await expect(page.locator('.walk-sign[data-kind="group"]').first()).toContainText('Spring Hackathon');
  const room = page.getByRole('region', { name: 'Winners’ Hall' });
  await expect(room).toContainText('Trophy room · 3 exhibits · Room 1 of 8');
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/winners-hall.png` });

  // MOVE ▶ walks on; the next winner's plaque lights up once Pip stops.
  await page.getByRole('button', { name: 'Next exhibit' }).click();
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*2\/3/);
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('Best UI · Education track · Spring Hackathon');
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('Lovely to use.');

  // The map: every room in walking order, each with its style in words; it jumps straight there.
  await page.getByRole('button', { name: 'MAP', exact: true }).click();
  const map = page.getByRole('region', { name: 'MUSEUM MAP' });
  await expect(map.getByRole('listitem')).toHaveText([
    /Winners’ Hall\s*Trophy room · 3 exhibits · You are here/,
    /Spring Hackathon\s*Arcade · 2 exhibits/,
    /Collab Wing\s*Lab · 1 exhibit/,
    /Web Wing\s*Garden · 2 exhibits/,
    /Games Wing\s*Arcade · 1 exhibit/,
    /Data Wing\s*Lab · 1 exhibit/,
    /All exhibits\s*Garden · 5 exhibits/,
    /The Archive\s*Library · 1 exhibit/,
  ]);
  await page.locator('.walk-screen').screenshot({ path: `${EVIDENCE}/map.png` });
  await map.getByRole('button', { name: /The Archive/ }).click();
  await expect(page).toHaveURL(/\/museum\?room=archive$/);
  await expect(hud(page)).toHaveText(/The Archive\s*1\/1/);
  await expect(line(page)).toHaveText('The Archive, 1 of 1: Old Robot, by Rosa Diaz. 2nd place · Robot Fair 2023. OPEN visits it.');
  await expect(page.locator('.walk-sign[data-kind="group"]').filter({ hasText: '2023' })).toHaveCount(1);
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('It really works.');
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/archive.png` });

  // Walking back with the keyboard goes through the doorway into All exhibits; the address follows.
  await screen(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/museum\?room=all$/);
  await expect(hud(page)).toHaveText(/All exhibits\s*5\/5/);

  // Makers in this room walk you to their work.
  const panel = page.getByRole('region', { name: 'All exhibits' });
  const makers = panel.getByRole('list', { name: 'Makers in All exhibits' });
  for (const name of ['Player player-1', 'Player player-2', 'Player player-3', 'Rosa Diaz']) await expect(makers).toContainText(name);
  await makers.getByRole('button', { name: /Player player-3/ }).click();
  await expect(line(page)).toContainText('Tide, by Player player-3.');
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('Tide');

  // OPEN visits the exhibit; Back comes back to the same one.
  await page.getByRole('button', { name: 'OPEN' }).click();
  await expect(page).toHaveURL(new RegExp(`/museum/${TIDE}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tide · Museum');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/museum\\?room=all&at=${TIDE}$`));
  await expect(line(page)).toContainText('Tide, by Player player-3.');

  // The room panel leads on; the event room shows its tracks as signs.
  await page.goto('/museum?event=spring-hack');
  await expect(hud(page)).toHaveText(/Spring Hackathon\s*1\/2/);
  await expect(page.locator('.walk-sign[data-kind="group"]').first()).toHaveText('Health track');
  await expect(page.getByRole('region', { name: 'Spring Hackathon' })).toContainText('Hackathon ·');
  await page.getByRole('region', { name: 'Spring Hackathon' }).getByRole('button', { name: /Next room: Collab Wing/ }).click();
  await expect(page).toHaveURL(/\/museum\?wing=collab$/);
  await expect(line(page)).toContainText('Collab Wing, 1 of 1: Kite, by Player player-1 with Player player-2.');

  // One link away: the list view, in the same room.
  await page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: /List view/ }).click();
  await expect(page).toHaveURL(/\/museum\?wing=collab&view=list$/);
  await expect(page.getByRole('region', { name: 'Collab Wing' }).getByRole('list', { name: 'Exhibits in the Collab Wing' })).toContainText('Kite');
  await page.getByRole('navigation', { name: 'How to see the Museum' }).getByRole('link', { name: 'Walk the Museum' }).click();
  await expect(page).toHaveURL(/\/museum\?wing=collab$/);
  await expect(hud(page)).toHaveText(/Collab Wing\s*1\/1/);
});

test('keyboard, drag and reduced motion: every way of walking gets there', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum');
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);

  // A drag to the left walks one exhibit on.
  const box = (await screen(page).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*2\/3/);

  // Page Down and Page Up change rooms; End and Home go to the ends; M opens the map and Esc closes it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await screen(page).focus();
  await page.keyboard.press('PageDown');
  await expect(hud(page)).toHaveText(/Spring Hackathon\s*1\/2/);
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('Kite'); // no walk: lit at once
  await page.keyboard.press('End');
  await expect(hud(page)).toHaveText(/The Archive\s*1\/1/);
  await page.keyboard.press('Home');
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);
  await page.keyboard.press('PageUp'); // already in the first room: stays
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);
  await page.keyboard.press('m');
  await expect(page.getByRole('region', { name: 'MUSEUM MAP' })).toBeVisible();
  await expect(page.getByRole('button', { name: /BACK to the walk/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'MUSEUM MAP' })).toHaveCount(0);
  await expect(screen(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/museum/${KITE}$`));
});

test('an admin picks a wing’s room style; visitors walk into it', async ({ page, browser }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Wings' }).click();
  const web = page.locator('.menu-panel[aria-label="Web Wing"]');
  await expect(web.getByLabel('Room style')).toHaveValue('garden');
  await web.getByLabel('Room style').selectOption('trophy');
  await web.getByRole('button', { name: 'Save Web Wing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Web Wing saved.' })).toBeVisible();
  expect(db.wings!.find((w) => w.key === 'web')?.style).toBe('trophy');
  await web.screenshot({ path: `${EVIDENCE}/admin-style.png` });
  // Saving something else leaves the style as it is.
  await web.getByLabel('Curator’s note').fill('Things you can open in a browser.');
  await web.getByRole('button', { name: 'Save Web Wing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Web Wing saved.' })).toBeVisible();
  expect(db.wings!.find((w) => w.key === 'web')).toMatchObject({ style: 'trophy', note: 'Things you can open in a browser.' });

  const visitor = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await boot(visitor);
  await mockSupabase(visitor, { db });
  await visitor.goto('/museum?wing=web');
  const room = visitor.getByRole('region', { name: 'Web Wing' });
  await expect(room).toContainText('Trophy room · 2 exhibits · Room 4 of 8');
  await expect(room.locator('.curator-note')).toContainText('Things you can open in a browser.');
  await visitor.close();
});

test('NIGHT dims the rooms; phones walk too; very narrow screens open the list first', async ({ page }) => {
  await boot(page);
  await page.addInitScript(() => localStorage.setItem('piphall-theme', 'dark'));
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum?wing=games');
  await expect(hud(page)).toHaveText(/Games Wing\s*1\/1/);
  await expect(page.locator('.walk-stop[data-lit]')).toContainText('Orbit');
  await page.locator('.device-outer').screenshot({ path: `${EVIDENCE}/games-night.png` });

  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/museum?wing=web');
  await expect(hud(page)).toHaveText(/Web Wing\s*1\/2/);
  await page.screenshot({ path: `${EVIDENCE}/phone.png`, fullPage: true });

  // 320px (a small phone, or 400% zoom): the list comes first, the walk one link away.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/museum');
  await expect(page.getByRole('navigation', { name: 'Rooms' })).toBeVisible();
  await expect(page.locator('.walk-screen')).toHaveCount(0);
  await page.getByRole('link', { name: 'Walk the Museum' }).click();
  await expect(page).toHaveURL(/\/museum\?view=walk$/);
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);
});

test('a room with nothing on show: Pip says so and starts at the first room', async ({ page }) => {
  await boot(page);
  await mockSupabase(page, { db: hall() });
  await page.goto('/museum?wing=featured');
  await expect(line(page)).toHaveText('That room has nothing on show right now, so Pip starts at the first one. MAP shows every room.');
  await expect(hud(page)).toHaveText(/Winners’ Hall\s*1\/3/);
});

test('200 exhibits: only the ones near Pip are mounted, and a still Museum draws nothing', async ({ page }) => {
  const db = hall();
  const p0 = ((db.published[0]!.card as Row).projects as Row[])[0]!;
  const id = (i: number) => `55555555-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const many = Array.from({ length: 200 }, (_, i) => ({
    project_id: id(i),
    username: 'player-1',
    full_name: 'Player player-1',
    avatar_path: null,
    member_no: 1,
    featured: false,
    console: null,
    project: { ...p0, id: id(i), title: `Exhibit ${i + 1}`, language: i % 2 ? 'TypeScript' : 'Python', tech_stack: [], collaborators: [] },
  }));
  await boot(page);
  await mockSupabase(page, { db });
  await page.route('**/rest/v1/rpc/museum_exhibits', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(many) }));
  await page.goto('/museum?room=all');
  await expect(hud(page)).toHaveText(/All exhibits\s*1\/201/);
  await expect(page.locator('.walk-stop')).toHaveCount(5); // the one in front of Pip and two each side

  // Walk 30 exhibits: never more than five (and the current one) on the page.
  await screen(page).focus();
  let most = 0;
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('ArrowRight');
    most = Math.max(most, await page.locator('.walk-stop').count());
  }
  await expect(hud(page)).toHaveText(/All exhibits\s*31\/201/);
  await expect(page.locator('.walk-stop[data-lit]')).toHaveCount(1); // the order is shuffled each visit
  expect(most).toBeLessThanOrEqual(6);

  // Standing still costs nothing: frames come at the display's rate (the level isn't redrawn).
  const gaps = await page.evaluate(
    () =>
      new Promise<number[]>((done) => {
        const t: number[] = [];
        const tick = (now: number) => {
          t.push(now);
          if (t.length < 60) requestAnimationFrame(tick);
          else done(t.slice(1).map((x, i) => x - t[i]!));
        };
        requestAnimationFrame(tick);
      }),
  );
  const median = [...gaps].sort((a, b) => a - b)[gaps.length >> 1]!;
  expect(median).toBeLessThan(20);
});
