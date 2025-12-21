import { defineConfig, devices } from '@playwright/test';

/**
 * HierarchiDB E2E Test Configuration
 *
 * See https://playwright.dev/docs/test-configuration.
 */
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';

const normalizeBasePath = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^\/+|\/+$/g, '');
};

const appName = normalizeBasePath(process.env.VITE_APP_NAME ?? process.env.PLAYWRIGHT_APP_NAME);
const defaultBaseURL = (() => {
  const basePath = appName ? `/${appName}` : '';
  return `http://localhost:4173${basePath}`;
})();

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
const normalizedBaseURL = rawBaseURL.replace(/\/*$/, '');
const baseURLWithSlash = `${normalizedBaseURL}/`;

export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html'],
    ['json', { outputFile: 'e2e-results.json' }],
    ['junit', { outputFile: 'e2e-results.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: baseURLWithSlash,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Record video only on failure */
    video: 'retain-on-failure',

    /* Emulate consistent timezone */
    timezoneId: 'Asia/Tokyo',

    /* Consistent locale */
    locale: 'ja-JP',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Increase viewport for TreeTable tests
        viewport: { width: 1920, height: 1080 },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },


    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: skipWebServer
    ? undefined
    : {
        // Build and preview the app to avoid file watcher limits in CI/sandboxes
        command:
          'pnpm --filter @hierarchidb/app build && pnpm --filter @hierarchidb/app preview -- --host 127.0.0.1 --port 4173',
        url: baseURLWithSlash,
        reuseExistingServer: !process.env.CI,
        timeout: 480 * 1000, // allow enough headroom because the app build routinely exceeds 3 minutes
      },

  /* Global setup and teardown */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  /* Test timeouts */
  timeout: 30 * 1000, // 30 seconds per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },

  /* Output directories */
  outputDir: 'e2e-results/',
});
