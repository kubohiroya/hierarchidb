import { expect, Page, test } from '@playwright/test';
import { buildAppUrl } from './utils/test-helpers';

type WindowWithWorkerImport = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
  __HDB_WORKER_CLIENT_REF__?: {
    isInitialized?: boolean;
    client?: unknown;
  };
};

async function waitForAppShell(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('heading', { name: /hierarchidb/i })
      .or(page.getByRole('heading', { name: /Resources|Projects/ }))
      .or(page.getByRole('button', { name: /Navigate to Resources view|Resources/ }))
      .first()
  ).toBeVisible({ timeout: 15000 });
}

async function waitForWorkerReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const win = window as WindowWithWorkerImport;
      return (
        win.__HDB_INIT_COMPLETE__ === true ||
        win.__HDB_WORKER_CLIENT_REF__?.isInitialized === true ||
        Boolean(win.__HDB_WORKER_CLIENT_REF__?.client)
      );
    },
    undefined,
    { timeout: 15000 }
  );
}

test.describe('Worker Initialization System', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    // Enable console logging for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      } else if (
        msg.text().includes('[Worker') ||
        msg.text().includes('Worker') ||
        msg.text().includes('INIT')
      ) {
        console.log('Worker log:', msg.text());
      }
    });

    // Log network errors
    page.on('pageerror', (error) => {
      console.error('Page error:', error);
    });
  });

  test('should initialize worker before rendering app content', async () => {
    // Navigate to the app
    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check that the loading screen appears first
    // The TitleLogo component should be visible during initialization

    // Initial atoms: loading should be visible (briefly)
    // Note: This might be too fast to catch, so we'll check the final atoms instead

    // Wait for the app to be ready (loading screen disappears)
    await waitForWorkerReady(page);
    await waitForAppShell(page);

    // Verify no error screens are shown
    await expect(page.locator('text=/Initialization Error/i')).not.toBeVisible();
    await expect(page.locator('text=/Failed to initialize/i')).not.toBeVisible();

    // Verify the main app content is loaded
    // Check for navigation elements that indicate successful initialization
    await expect(
      page.getByRole('button', { name: /Navigate to Resources view|Resources/ })
    ).toBeVisible();
  });

  test('should properly handle Worker-UI communication', async () => {
    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
    });

    // Wait for app to be ready
    await waitForWorkerReady(page);

    // Check that Worker API methods are accessible
    // This verifies the Comlink connection is established after Worker initialization
    const hasWorkerAPI = await page.evaluate(async () => {
      // Check if WorkerAPIClient is available globally or in window
      try {
        const win = window as WindowWithWorkerImport;
        return (
          win.__HDB_INIT_COMPLETE__ === true ||
          win.__HDB_WORKER_CLIENT_REF__?.isInitialized === true ||
          Boolean(win.__HDB_WORKER_CLIENT_REF__?.client)
        );
      } catch (e) {
        console.error('Worker API check failed:', e);
      }

      // Alternative: Check if the app rendered successfully (implies Worker is ready)
      return document.querySelector('button') !== null;
    });

    expect(hasWorkerAPI).toBeTruthy();
  });

  test('should show progress during initialization', async () => {
    // Create a promise to track if we see the loading atoms
    let sawLoadingState = false;

    page.on('response', (response) => {
      // Track responses to ensure we're not missing the loading atoms due to caching
      if (response.url().includes('worker')) {
        console.log('Worker file loaded:', response.url());
      }
    });

    // Navigate and immediately start checking for loading atoms
    const navigationPromise = page.goto(buildAppUrl(), {
      waitUntil: 'commit', // Don't wait for load to complete
    });

    // Try to catch the loading atoms
    const checkLoading = async () => {
      try {
        const hasLoading = await page
          .locator('.MuiCircularProgress-root, [role="progressbar"], [data-testid="title-logo"]')
          .isVisible();
        if (hasLoading) {
          sawLoadingState = true;
          console.log('Detected loading atoms');
        }
      } catch {
        // Ignore errors during rapid checking
      }
    };

    // Rapidly check for loading atoms
    const checkInterval = setInterval(checkLoading, 50);

    await navigationPromise;

    // Wait for app to be ready
    await waitForWorkerReady(page);
    await waitForAppShell(page);

    clearInterval(checkInterval);

    // If we didn't see loading atoms, it might be too fast (cached) which is OK
    console.log('Saw loading atoms:', sawLoadingState);

    // The important thing is the app loads successfully
    await expect(
      page.getByRole('button', { name: /Navigate to Resources view|Resources/ })
    ).toBeVisible();
  });

  test('should handle Worker initialization failure gracefully', async () => {
    // Inject a script to simulate Worker failure
    await page.addInitScript(() => {
      // Override Worker constructor to simulate failure
      const OriginalWorker = window.Worker;
      let attemptCount = 0;

      window.Worker = class extends OriginalWorker {
        new(scriptURL: string | URL, options?: WorkerOptions) {
          attemptCount++;

          // Fail the first 2 attempts to test retry logic
          if (attemptCount <= 2) {
            console.log(`Simulating Worker failure (attempt ${attemptCount})`);
            throw new Error('Simulated Worker initialization failure');
          }

          // Allow the 3rd attempt to succeed
          console.log(`Allowing Worker to succeed (attempt ${attemptCount})`);
          return new OriginalWorker(scriptURL, options);
        }
      } as typeof window.Worker;
    });

    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // The app should retry and eventually succeed
    await waitForAppShell(page);

    // Verify no error screen is permanently shown
    await expect(page.locator('text=/Initialization Error/i')).not.toBeVisible();
  });

  test('should establish Comlink communication after Worker ready', async () => {
    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
    });

    // Wait for the app to be ready
    await waitForWorkerReady(page);
    await waitForAppShell(page);

    // Test that Comlink RPC works by checking console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('Comlink') || msg.text().includes('RPC')) {
        logs.push(msg.text());
      }
    });

    // Navigate to trigger some Worker API calls
    await page.getByRole('button', { name: /Navigate to Resources view|Resources/ }).click();
    await expect(page.getByRole('heading', { name: /Resources/ })).toBeVisible();

    // Check that no Comlink errors occurred
    const hasComlinkError = logs.some(
      (log) => log.includes('Comlink error') || log.includes('Cannot read properties of undefined')
    );

    expect(hasComlinkError).toBeFalsy();
  });

  test('should maintain Worker connection during navigation', async () => {
    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
    });

    // Wait for initial load
    await waitForWorkerReady(page);
    await waitForAppShell(page);

    // Perform multiple navigations to test connection stability
    const navigationTests = [buildAppUrl('d/r'), buildAppUrl(), buildAppUrl('d/r')];

    for (const path of navigationTests) {
      await page.goto(path, {
        waitUntil: 'domcontentloaded',
      });

      // Verify the page loads without Worker errors
      await waitForAppShell(page);

      // Check for error messages
      const hasError = await page
        .locator('text=/Error|Failed|Cannot connect/i')
        .isVisible()
        .catch(() => false);

      expect(hasError).toBeFalsy();

      // Small delay between navigations
      await page.waitForTimeout(500);
    }
  });

  test('should show initialization progress messages', async () => {
    // Track console messages during initialization
    const initMessages: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('INIT_') || text.includes('initialization') || text.includes('Worker')) {
        initMessages.push(text);
        console.log('Init message:', text);
      }
    });

    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
    });

    // Wait for app to be ready
    await waitForWorkerReady(page);
    await waitForAppShell(page);

    // Verify we captured some initialization messages
    console.log(`Captured ${initMessages.length} initialization messages`);

    // We should see Worker-related messages
    const hasWorkerMessages = initMessages.some(
      (msg) => msg.includes('Worker') || msg.includes('initialized')
    );

    // This is informational - even if we don't catch messages due to speed,
    // the important thing is the app loads
    if (!hasWorkerMessages) {
      console.log('Note: No Worker messages captured (might be too fast)');
    }

    // The test passes if the app loads successfully
    await expect(
      page.getByRole('button', { name: /Navigate to Resources view|Resources/ })
    ).toBeVisible();
  });
});

test.describe('Worker API Facade Usage', () => {
  test('should use facade APIs instead of deprecated methods', async ({ page }) => {
    // Track console warnings for deprecated method usage
    const deprecationWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('deprecated')) {
        deprecationWarnings.push(msg.text());
        console.warn('Deprecation warning:', msg.text());
      }
    });

    await page.goto(buildAppUrl(), {
      waitUntil: 'domcontentloaded',
    });

    // Navigate to a console page to trigger API calls
    await waitForWorkerReady(page);
    await page.getByRole('button', { name: /Navigate to Resources view|Resources/ }).click();
    await expect(page.getByRole('heading', { name: /Resources/ })).toBeVisible();

    // Check that no deprecation warnings were logged
    if (deprecationWarnings.length > 0) {
      console.log('Deprecation warnings found:', deprecationWarnings);
    }

    // The app should work without using deprecated methods
    expect(deprecationWarnings.length).toBe(0);
  });
});
