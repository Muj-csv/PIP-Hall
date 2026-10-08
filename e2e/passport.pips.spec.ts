// V2-2 for an approved member (Supabase data source, PIPs on): the Passport lives in the account,
// exhibits are stamped there, and a device Passport comes over as history without PIPs (D-097).
import { expect, test } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, rewardApproval, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const OTHER = '00000000-0000-4000-8000-000000000201';
const THIRD = '00000000-0000-4000-8000-000000000202';
const P = '00000000-0000-4000-8000-00000000f101';

function card(id: string, username: string, no: number, projects: unknown[] = []): Row {
  const base = samples[0]!;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...base.card, username, full_name: `Player ${username}`, is_featured: false, projects } };
}

function hall(): MockDb {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1));
  db.published.push(card(OTHER, 'player-1', 2, [{ ...samples[0]!.card.projects[0]!, id: P, title: 'Tide Tables' }]));
  db.published.push(card(THIRD, 'player-2', 3));
  rewardApproval(db, ME.id);
  db.affiliations = [{ key: 'cs', name: 'CS', grants_museum: true, frame_key: null, sort: 1 }];
  db.memberAffiliations = [{ member_id: OTHER, key: 'cs' }];
  db.museumEntries = [{ project_id: P, member_id: OTHER }];
  return db;
}

test('a member’s Passport is in their account: exhibits stamp there, and device stamps come over as history', async ({ page }) => {
  const db = hall();
  await page.addInitScript(([third]) => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
    // Collected as a guest on this phone before signing in.
    localStorage.setItem('piphall-passport-v1', JSON.stringify({ people: [{ id: third, at: '2026-10-06T02:00:00.000Z' }], exhibits: [] }));
  }, [THIRD]);
  await mockSupabase(page, { user: ME, db });
  const ledgerBefore = (db.ledger ?? []).length;

  await page.goto(`/museum/${P}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tide Tables');
  await expect.poll(() => db.passportVisits?.length ?? 0).toBe(1);

  await page.goto('/passport');
  const screen = page.locator('.passport-screen');
  await expect(screen).toContainText('Saved to your account.');
  await expect(screen.getByRole('list', { name: 'Exhibits you’ve visited' })).toContainText('Tide Tables');
  await expect(screen).toContainText('This device has 1 stamp your account doesn’t.');
  await screen.getByRole('button', { name: 'Bring them over' }).click();
  await expect(screen.getByRole('status')).toHaveText('Added 1 stamp from this device to your Passport, as history.');
  await expect(screen.getByRole('list', { name: 'People you found' })).toContainText('From this device');
  expect(db.discoveries).toEqual([expect.objectContaining({ member_id: ME.id, card_id: THIRD, source: 'imported' })]);
  expect((db.ledger ?? []).length).toBe(ledgerBefore); // no PIPs for history
  expect(await page.evaluate(() => localStorage.getItem('piphall-passport-v1'))).toBe(JSON.stringify({ people: [], exhibits: [], checkins: [] }));
  await expect(screen.getByRole('button', { name: 'Bring them over' })).toHaveCount(0);
});
