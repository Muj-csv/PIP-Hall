// V2-22 (D-134, D-135): Pip's new look, the affiliation frames with an admin-uploaded logo, and the
// band. Supabase data source, mocked, PIPs on. The logo here is a plain test picture made by the
// test: the code and the repository never hold an organization's logo (D-135).
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { emptyDb, type MockDb, type Row } from './mockDb';
import { mockSupabase } from './mockSupabase';

const ME = { id: '00000000-0000-4000-8000-0000000000a1', email: 'me@example.org', name: 'Test Member', role: 'member' as const };
const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', email: 'admin@example.org', name: 'Test Admin', role: 'admin' as const };
const EVIDENCE = 'docs/build/evidence/looks';

/** A generic stand-in for a logo: a ring on a square, drawn here. */
const testLogo = () =>
  sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2a8c82"/><circle cx="32" cy="32" r="18" fill="none" stroke="#ffffff" stroke-width="7"/></svg>'))
    .png()
    .toBuffer();

/** Me in the hall with an approved card, tagged with one affiliation, holding one admin-made badge. */
async function hall(): Promise<MockDb> {
  const db = emptyDb();
  db.identity = true;
  db.logoPng = await testLogo();
  db.profiles.push({ id: ME.id, username: 'me-player', full_name: 'Test Member', tagline: null, bio: 'Builds pixel things.', role: 'Frontend dev', org_position: null, department: null, avatar_path: null, github_username: null, linkedin_url: null, portfolio_url: null, public_email: null, show_email: false, email_updates: false, skills: ['TypeScript'], status: 'approved', review_note: null, is_featured: false, username_locked: true, member_no: 1 });
  const base = samples[0]!;
  db.published.push({ ...base, profile_id: ME.id, username: 'me-player', member_no: 1, is_featured: false, card: { ...base.card, username: 'me-player', full_name: 'Test Member', is_featured: false } } as Row);
  db.affiliations = [{ key: 'code-guild', name: 'Code Guild', grants_museum: false, frame_key: null, sort: 1, logo_path: null }];
  db.memberAffiliations = [{ member_id: ME.id, key: 'code-guild' }];
  db.customBadges = [{ key: 'helper', name: 'Helper', description: 'Helped at the hall’s first event.', gem: 'star', tone: 'gold', reward: 0, active: true }];
  db.memberAchievements = [{ member_id: ME.id, key: 'helper', unlocked_at: '2026-10-05T09:00:00Z' }];
  db.ledger = [{ id: 1, member_id: ME.id, amount: 120, reason: 'first_approval', ref: 'first_approval', created_at: '2026-10-05T09:00:00Z' }];
  return db;
}

const boot = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // still pictures for the evidence
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
};
const badge = (page: Page) => page.locator('.editor-side .preview-stage .badge');
const band = (page: Page) => badge(page).locator('.badge-face[data-side="front"]').getByRole('list', { name: 'Badges' });
const row = (page: Page, name: string) => page.locator('.mart-row').filter({ has: page.getByText(name, { exact: true }) });

test('an admin uploads a logo and gives a frame; a member wears it and puts the pin on their band', async ({ page, browser }) => {
  const db = await hall();
  await boot(page);
  await mockSupabase(page, { user: ADMIN, db });
  await page.goto('/admin');
  await page.getByRole('tab', { name: 'Affiliations' }).click();
  const look = page.getByRole('group', { name: 'Code Guild: frame and logo' });
  await look.getByLabel('Frame for its members').selectOption('diamond');
  await expect(page.locator('main > .notice')).toHaveText('Code Guild members can now wear the Diamond frame.');

  // Only a PNG or WebP; then the logo itself.
  const file = look.locator('input[type=file]');
  await expect(file).toHaveAttribute('accept', 'image/png,image/webp');
  await file.setInputFiles({ name: 'logo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a png') });
  await expect(look.getByRole('alert')).toContainText('Use a PNG or WebP logo');
  await file.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: db.logoPng! });
  await expect(page.locator('main > .notice')).toHaveText('Code Guild has its logo. Its members see it on their frame and can wear it as a pin.');
  await expect(look.getByRole('img', { name: 'Code Guild logo' })).toBeVisible();
  const logoPath = String(db.affiliations![0]!.logo_path);
  expect(logoPath).toMatch(new RegExp(`^${ADMIN.id}/[0-9a-f-]{36}\\.png$`));
  expect(db.logoUploads).toEqual([logoPath]);
  await expect(page.getByText('Diamond frame · logo', { exact: false })).toBeVisible();
  await page.locator('.menu-panel').filter({ has: page.getByRole('heading', { name: 'Affiliations' }) }).screenshot({ path: `${EVIDENCE}/admin-affiliation.png` });

  // The member, in My Card → Customize: the frame with the logo, free.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }); // sharper close-ups of the badge
  const me = await ctx.newPage();
  await boot(me);
  await mockSupabase(me, { user: ME, db, githubRepos: [] });
  await me.goto('/edit?tab=customize');
  const frame = row(me, 'Code Guild · Diamond frame');
  await expect(frame).toContainText('Free with your Code Guild affiliation.');
  await frame.getByRole('button', { name: /Wear/ }).click();
  await expect(me.getByRole('status').filter({ hasText: 'Wearing the Code Guild · Diamond frame.' })).toBeVisible();
  await expect(badge(me)).toHaveAttribute('data-frame', 'diamond');
  await expect(badge(me).locator('.badge-face[data-side="front"] .holder-logo')).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/affiliation-logos/${logoPath}$`));
  await expect(badge(me).locator('.badge-face[data-side="front"] .holder-print')).toHaveText('Code Guild');

  // The band: until chosen, the hall picks (the badge); then the member picks and orders.
  const picker = me.getByRole('region', { name: 'Band' });
  await expect(picker.getByRole('status')).toHaveText('The hall picks your band for now.');
  await expect(band(me).getByRole('listitem')).toHaveText(['Helper']);
  await picker.getByRole('checkbox', { name: /Code Guild · Affiliation pin/ }).check();
  await picker.getByRole('checkbox', { name: /Helper · Badge/ }).check();
  const order = picker.getByRole('list', { name: 'On your band, in order' });
  await expect(order.getByRole('listitem')).toHaveText([/Code Guild/, /Helper/]);
  await picker.getByRole('button', { name: 'Move Helper earlier' }).click();
  await expect(order.getByRole('listitem')).toHaveText([/Helper/, /Code Guild/]);
  await picker.getByRole('button', { name: 'Save band' }).click();
  await expect(me.getByRole('status').filter({ hasText: 'Your band is saved.' })).toBeVisible();
  expect(db.appearance?.find((a) => a.member_id === ME.id)?.band).toEqual(['badge:helper', 'pin:code-guild']);
  await expect(band(me).getByRole('listitem')).toHaveText(['Helper', 'Code Guild']);
  await expect(band(me).locator('img.pin-logo')).toHaveCount(1);
  await me.evaluate(() => window.scrollTo(0, 0));
  await me.screenshot({ path: `${EVIDENCE}/customize-band.png`, fullPage: true });

  // Visitors see it on the profile.
  await me.goto('/member/me-player');
  const profile = me.locator('.profile-screen .badge').first();
  await expect(profile).toHaveAttribute('data-frame', 'diamond');
  await expect(profile.locator('.badge-face[data-side="front"]').getByRole('list', { name: 'Badges' }).getByRole('listitem')).toHaveText(['Helper', 'Code Guild']);
  await profile.screenshot({ path: `${EVIDENCE}/badge-diamond.png` });

  // The admin switches the design to Cat-eye: the badge follows.
  await look.getByLabel('Frame for its members').selectOption('cateye');
  await expect(page.locator('main > .notice')).toHaveText('Code Guild members can now wear the Cat-eye frame.');
  await me.reload();
  await expect(profile).toHaveAttribute('data-frame', 'cateye');
  await profile.screenshot({ path: `${EVIDENCE}/badge-cateye.png` });

  // Taking the logo away takes the pin off every band, and the logo off the frame.
  await look.getByRole('button', { name: 'Remove logo' }).click();
  await expect(page.locator('main > .notice')).toHaveText('Code Guild’s logo is gone from its frame and from every band.');
  expect(db.affiliations![0]!.logo_path).toBeNull();
  expect(db.logoUploads).toEqual([]);
  await me.reload();
  await expect(profile.locator('.badge-face[data-side="front"]').getByRole('list', { name: 'Badges' }).getByRole('listitem')).toHaveText(['Helper']);
  await expect(profile.locator('.holder-logo')).toHaveCount(0);
  await ctx.close();
});

test('a member who isn’t tagged sees no affiliation frame or pin, and can let the hall pick again', async ({ page }) => {
  const db = await hall();
  db.memberAffiliations = [];
  db.affiliations![0]!.frame_key = 'diamond';
  db.affiliations![0]!.logo_path = `${ADMIN.id}/11111111-2222-3333-4444-555555555555.png`;
  db.appearance = [{ member_id: ME.id, frame: null, frame_affiliation: null, band: [] }];
  await boot(page);
  await mockSupabase(page, { user: ME, db, githubRepos: [] });
  await page.goto('/edit?tab=customize');
  await expect(page.getByRole('region', { name: 'Frame' })).not.toContainText('Code Guild');
  const picker = page.getByRole('region', { name: 'Band' });
  await expect(picker.getByRole('checkbox')).toHaveCount(1); // the badge only
  await expect(picker.getByRole('status')).toHaveText('0 of 3 on your band');
  await expect(badge(page).getByRole('list', { name: 'Badges' })).toHaveCount(0); // chose an empty band
  await picker.getByRole('button', { name: 'Let the hall pick' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The hall picks your band again.' })).toBeVisible();
  expect(db.appearance[0]!.band).toBeNull();
  await expect(band(page).getByRole('listitem')).toHaveText(['Helper']);
});

test('Pip, redrawn: a blue diamond with a white face and red cat eyes, by day and by night', async ({ page }) => {
  const db = await hall();
  await boot(page);
  await mockSupabase(page, { db });
  await page.goto('/');
  const screen = page.locator('.screen').first();
  await expect(screen).toBeVisible();
  await expect(page.locator('.dialogue canvas').first()).toBeVisible(); // Pip's portrait in the text window
  await page.screenshot({ path: `${EVIDENCE}/pip-day.png` });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.reload();
  await expect(screen).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/pip-night.png` });
});
