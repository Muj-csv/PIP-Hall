// Save badge (D-095, D-104): the approved badge is drawn in the browser (the same drawing as the
// server's) and saved as a 1080×1350 PNG, without depending on a server function.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import samples from '../src/data/sample-cards.json' with { type: 'json' };
import { mockSupabase } from './mockSupabase';

test('Save badge draws the approved badge and downloads a 1080×1350 PNG', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('piphall-booted', '1');
    sessionStorage.setItem('piphall-splash', '1');
  });
  await mockSupabase(page, { publishedCards: samples });
  let serverCalls = 0;
  await page.route('**/api/badge?u=*', (r) => {
    serverCalls++;
    return r.fulfill({ status: 500, body: 'down' });
  });
  await page.goto('/member/sample-player-4');
  const save = page.locator('.profile-screen').getByRole('button', { name: 'Save badge (PNG)' });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), save.click()]);
  expect(download.suggestedFilename()).toBe('pip-hall-sample-player-4.png');
  const png = readFileSync((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080); // IHDR width
  expect(png.readUInt32BE(20)).toBe(1350); // IHDR height
  expect(png.length).toBeGreaterThan(20_000); // a real picture, not a blank canvas
  await expect(page.locator('.profile-screen').getByRole('status').filter({ hasText: 'Saved as pip-hall-sample-player-4.png' })).toBeVisible();
  expect(serverCalls).toBe(0); // no server function needed
  await import('node:fs').then((fs) => {
    fs.mkdirSync('docs/build/evidence/share-previews', { recursive: true });
    fs.writeFileSync('docs/build/evidence/share-previews/badge-from-browser.png', png);
  });
});
