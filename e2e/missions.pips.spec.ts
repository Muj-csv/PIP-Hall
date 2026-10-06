// V2-3 for an approved member (Supabase data source, PIPs on): a finished Mission is claimed, the
// database checks it again and pays +10, and the HUD shows the new balance. The other members here
// list no skills, departments or projects, so "meet 3 people" is the only Mission the hall can offer.
import { expect, test } from '@playwright/test';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, rewardApproval, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ids = ['00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000203'];

function card(id: string, username: string, no: number, bare: boolean): Row {
  const base = samples[0]!;
  const c = bare ? { ...base.card, skills: [], projects: [], department: null } : base.card;
  return { ...base, profile_id: id, username, member_no: no, is_featured: false, card: { ...c, username, full_name: `Player ${username}`, is_featured: false } };
}

test('a member claims a finished Mission: the database checks it and pays +10', async ({ page }) => {
  const db = emptyDb();
  db.published.push(card(ME.id, 'me-player', 1, false));
  ids.forEach((id, i) => db.published.push(card(id, `player-${i + 1}`, i + 2, true)));
  rewardApproval(db, ME.id); // 150
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
  await mockSupabase(page, { user: ME, db });

  await page.goto('/');
  const mission = page.locator('.mission', { hasText: 'Meet 3 people you haven’t met' });
  await expect(page.getByRole('list', { name: 'Today’s Missions' }).locator('li')).toHaveCount(1);
  await expect(mission).toContainText('+10 PIPs');
  await expect(mission).toHaveAttribute('data-state', 'open');
  await expect(page.locator('.missions-panel')).not.toContainText('stamped on this device');

  for (let i = 1; i <= 3; i++) {
    await page.goto(`/member/player-${i}`);
    await expect(page.locator('.profile-screen .dialogue').first()).toContainText('+5 PIPs');
  }
  await page.goto('/');
  await expect(mission).toHaveAttribute('data-state', 'ready');
  await mission.getByRole('button', { name: /^Claim/ }).click();
  await expect(page.locator('.missions-panel').getByRole('status')).toHaveText('Mission complete! +10 PIPs.');
  await expect(mission).toHaveAttribute('data-state', 'done');
  await expect(page.locator('.hud-coins')).toHaveText('×175'); // 150 + 3 × 5 + 10
  expect(db.missionCompletions).toHaveLength(1);
  expect(db.ledger!.filter((r) => r.reason === 'mission').map((r) => r.amount)).toEqual([10]);
});
