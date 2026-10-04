import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM_PATH lets sandboxes with a preinstalled Chromium skip `playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

// Auth runs against a fake Supabase origin. Tests intercept every request to it
// (e2e/mockSupabase.ts), so nothing ever leaves the machine.
const FAKE_SUPABASE_URL = 'https://pip-e2e.supabase.co';
const env = (dataSource: 'fixture' | 'supabase') => ({
  VITE_DATA_SOURCE: dataSource,
  // PIPs are on for the Supabase server only, so the fixture suite also proves the switch-off path.
  VITE_FEATURE_PIPS: dataSource === 'supabase' ? 'on' : 'off',
  VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
  VITE_PUBLIC_ORIGIN: 'https://pip-hall.example',
});

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /(data-source|admin|pips)\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } },
    },
    {
      name: 'phone',
      testIgnore: /(data-source|admin|pips)\.spec/,
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5173', launchOptions: { executablePath } },
    },
    {
      name: 'supabase-data',
      testMatch: /(data-source|admin|pips)\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5174', viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } },
    },
  ],
  webServer: [
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      env: env('fixture'),
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      env: env('supabase'),
    },
  ],
});
