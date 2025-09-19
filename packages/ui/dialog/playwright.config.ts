import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  timeout: 60_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:6307',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec http-server storybook-static --port 6307 --silent',
    url: 'http://localhost:6307',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
