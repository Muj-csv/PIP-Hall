// V2-6 (D-102): the Museum as a place. Wings fill themselves from the exhibits; each has a door,
// a room with its curator's note, and paths on from an exhibit. Admins curate in Admin → Wings.
// Supabase data source, mocked; the database rules are in supabase/tests/security.test.mjs.
import { expect, test, type Page } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, SEED_WINGS, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ADA = '00000000-0000-4000-8000-0000000000a1';
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const P = ['00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f003'];

/** Ada in the hall with three exhibits: Python data, a React site, and a Lua team game. */
function hall(withWings = true): MockDb {
  const db = emptyDb();
  const base = samples[0]!;
  const proj = (i: number, title: string, language: string, tech: string[], collab = false) => ({
    ...base.card.projects[0]!,
    id: P[i],
    title,
    description: null,
    language,
    tech_stack: tech,
    collaborators: collab ? [{ username: 'sample-player-2', full_name: 'Sample Player 2', member_no: 2 }] : [],
  });
  const projects = [proj(0, 'Tide Tables', 'Python', ['Pandas']), proj(1, 'Pixel Diary', 'TypeScript', ['React']), proj(2, 'Kite Run', 'Lua', ['Love2D'], true)];
  db.published.push({ ...base, profile_id: ADA, username: 'ada', member_no: 1, is_featured: false, card: { ...base.card, username: 'ada', full_name: 'Ada Lovelace', projects } } as Row);
  db.affiliations = [{ key: 'cs-student', name: 'CS Student', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [{ member_id: ADA, key: 'cs-student' }];
  db.museumEntries = P.map((project_id) => ({ project_id, member_id: ADA, console: null }));
  if (withWings) {
    db.wings = SEED_WINGS.map((w) => ({ ...w, tags: [...(w.tags as string[])] }));
    db.wings.find((w) => w.key === 'web')!.note = 'Things you can open in a browser.';
  }
  return db;
}

const boot = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
const doors = (page: Page) => page.getByRole('navigation', { name: 'Wings' }).getByRole('link');

test('visitors walk through the wings: doors, rooms, curator notes, and paths on', async ({ page }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { db, publishedCards: db.published });
  await page.goto('/museum');

  // Only wings with something on show have a door (no Featured: nobody is featured).
  await expect(doors(page)).toHaveText([/All exhibits/, /Collab Wing\s*1 exhibit/, /Web Wing\s*1 exhibit/, /Games Wing\s*1 exhibit/, /Data Wing\s*1 exhibit/]);
  await expect(doors(page).first()).toHaveAttribute('aria-current', 'page');
  await page.getByRole('navigation', { name: 'Wings' }).screenshot({ path: 'docs/build/evidence/wings/doors.png' });

  await doors(page).filter({ hasText: 'Web Wing' }).click();
  await expect(page).toHaveURL(/\/museum\?wing=web$/);
  const room = page.getByRole('region', { name: 'Web Wing' });
  await expect(room.getByRole('heading', { name: 'Web Wing' })).toBeVisible();
  await expect(room.locator('.curator-note')).toContainText('Things you can open in a browser.');
  await expect(room.locator('.curator-note')).toContainText('Curator’s note');
  await expect(room.getByRole('list', { name: 'Exhibits in the Web Wing' }).locator(':scope > li')).toHaveCount(1);
  await expect(room).toContainText('Pixel Diary');
  await expect(doors(page).filter({ hasText: 'Web Wing' })).toHaveAttribute('aria-current', 'page');
  await room.screenshot({ path: 'docs/build/evidence/wings/web-wing.png' });

  // A wing without a note says nothing rather than something made up.
  await doors(page).filter({ hasText: 'Data Wing' }).click();
  await expect(page.getByRole('region', { name: 'Data Wing' }).locator('.curator-note')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Data Wing' })).toContainText('Projects built with Python');

  // From an exhibit, its wings and the way on.
  await page.goto(`/museum/${P[2]}`);
  const around = page.getByRole('region', { name: 'In the Museum’s wings' });
  await expect(around.getByRole('link')).toHaveText([/Collab Wing/, /Games Wing/]);
  await around.getByRole('link', { name: /Games Wing/ }).click();
  await expect(page).toHaveURL(/\/museum\?wing=games$/);

  // A wing that is closed or empty sends the visitor back to the rest.
  await page.goto('/museum?wing=featured');
  await expect(page.locator('.dialogue').filter({ hasText: 'That wing has nothing on show right now' })).toBeVisible();
});

test('an admin writes a curator note and opens a wing; visitors see both', async ({ page, browser }) => {
  const db = hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Wings' }).click();
  const data = page.locator('.menu-panel[aria-label="Data Wing"]');
  await data.getByLabel('Curator’s note').fill('Numbers that tell stories.');
  await data.getByRole('button', { name: 'Save Data Wing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Data Wing saved.' })).toBeVisible();

  const form = page.getByRole('form', { name: 'Open a new wing' });
  await form.getByLabel('Name').fill('Toys Wing');
  await form.getByLabel('Tags (comma-separated)').fill('Love2D, Pico-8');
  await form.getByRole('button', { name: 'Open wing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Toys Wing is open' })).toBeVisible();
  expect(db.wings!.find((w) => w.key === 'toys-wing')?.tags).toEqual(['Love2D', 'Pico-8']);
  await page.locator('section[aria-labelledby="wings-title"]').screenshot({ path: 'docs/build/evidence/wings/admin-wings.png' });

  const visitor = await browser.newPage();
  await boot(visitor);
  await mockSupabase(visitor, { db, publishedCards: db.published });
  await visitor.goto('/museum?wing=data');
  await expect(visitor.locator('.curator-note')).toContainText('Numbers that tell stories.');
  await expect(doors(visitor).filter({ hasText: 'Toys Wing' })).toContainText('1 exhibit');
  await visitor.close();
});

test('before the wings update, the default wings still lead somewhere, with no notes', async ({ page }) => {
  const db = hall(false);
  await boot(page);
  await mockSupabase(page, { db, publishedCards: db.published });
  await page.goto('/museum');
  await expect(doors(page)).toHaveCount(5);
  await doors(page).filter({ hasText: 'Web Wing' }).click();
  await expect(page.getByRole('region', { name: 'Web Wing' })).toContainText('Pixel Diary');
  await expect(page.locator('.curator-note')).toHaveCount(0);
});
