import { defineConfig, devices } from '@playwright/test';
import { resolveE2EUrlContract } from './e2e/utils/e2e-url-contract';

/**
 * HierarchiDB E2E Test Configuration
 *
 * See https://playwright.dev/docs/test-configuration.
 */
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const e2eUrlContract = resolveE2EUrlContract();
const previewURL = new URL(e2eUrlContract.baseURL);
const previewHost = process.env.PLAYWRIGHT_PREVIEW_HOST ?? (
  previewURL.hostname === 'localhost' ? '127.0.0.1' : previewURL.hostname
);
const previewPort = previewURL.port || (previewURL.protocol === 'https:' ? '443' : '80');
const shellValue = (value: string): string => JSON.stringify(value);
const fastArtifacts = process.env.HIERARCHIDB_E2E_FAST_ARTIFACTS === '1';
const chromiumWebGLLaunchArgs = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--enable-webgl2',
];

export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the stage on CI if you accidentally left test.only in the source code. */
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
    /* Base URL to use in app navigation helpers and relative Playwright actions. */
    baseURL: e2eUrlContract.baseURLWithSlash,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: fastArtifacts ? 'off' : 'on-first-retry',

    /* Take screenshot only on failure */
    screenshot: fastArtifacts ? 'off' : 'only-on-failure',

    /* Record video only on failure */
    video: fastArtifacts ? 'off' : 'retain-on-failure',

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
        launchOptions: {
          args: chromiumWebGLLaunchArgs,
        },
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
        command: `HDB_SOURCE_SHA=0000000000000000000000000000000000000000 VITE_APP_NAME=${shellValue(e2eUrlContract.appName)} pnpm -w turbo run build --filter @hierarchidb/app... && pnpm --filter @hierarchidb/app exec vite preview --host ${shellValue(previewHost)} --port ${shellValue(previewPort)}`,
        url: e2eUrlContract.baseURLWithSlash,
        reuseExistingServer: !process.env.CI,
        timeout: 480 * 1000, // allow enough headroom because the app stage routinely exceeds 3 minutes
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
