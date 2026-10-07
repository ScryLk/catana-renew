import { defineConfig } from '@playwright/test';

process.env.CATANA_SOCIAL_AUTH_E2E = 'true';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'social-auth.spec.ts',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  outputDir: 'test-results-social-auth',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-social-auth' }]],
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'clerk', grep: /Clerk social authentication/, use: { baseURL: 'http://127.0.0.1:5174' } },
    { name: 'legacy', grep: /Explicit legacy authentication/, use: { baseURL: 'http://127.0.0.1:5175' } },
  ],
  webServer: [
    {
      command: 'CATANA_SOCIAL_AUTH_TEST_PROVIDER=clerk npx vite --config vite.social-auth-test.config.ts --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
    },
    {
      command: 'CATANA_SOCIAL_AUTH_TEST_PROVIDER=legacy npx vite --config vite.social-auth-test.config.ts --host 127.0.0.1 --port 5175 --strictPort',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
    },
  ],
});
