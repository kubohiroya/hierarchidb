import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /feature-table-edit-workflows\.spec\.ts/u,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 20_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    timezoneId: 'Asia/Tokyo',
    locale: 'ja-JP',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
