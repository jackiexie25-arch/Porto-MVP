import { defineConfig, devices } from '@playwright/test';
import { ANON_KEY, APP_PORT, APP_URL, MINI_SUPABASE_URL } from './e2e/constants.mjs';

/**
 * End-to-end tests run the real app (a production build) against a test-only stand-in for
 * Supabase that applies Porto's real migrations in PGlite. Nothing touches the live project.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mini-supabase.mjs',
      url: `${MINI_SUPABASE_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Real env vars take priority over .env.local, so this build only ever talks to the stand-in.
      command: `npx vite build --outDir dist-e2e --emptyOutDir --logLevel warn && npx vite preview --outDir dist-e2e --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      url: APP_URL,
      env: {
        VITE_SUPABASE_URL: MINI_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: ANON_KEY,
        VITE_PRIVACY_CONTACT_EMAIL: 'privacy@example.test',
      },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
