import { chromium, FullConfig, firefox } from '@playwright/test';
import { resolveE2EUrlContract } from './utils/e2e-url-contract';

const e2eUrlContract = resolveE2EUrlContract();
const SERVER_READY_TIMEOUT_MS = 180000;
const NAVIGATION_TIMEOUT_MS = 120000;
const FIREFOX_LAUNCH_PROBE_TIMEOUT_MS = 30_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForServerReady = async (serverUrl: string, timeoutMs: number): Promise<void> => {
  const startedAt = Date.now();
  let lastError = 'unknown';

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(serverUrl, {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
      });
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }

  throw new Error(`Server readiness check timed out (${timeoutMs}ms): ${serverUrl} (${lastError})`);
};

const getExplicitProjectFilters = (): string[] => {
  const filters: string[] = [];
  const args = process.argv;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--project' && typeof args[index + 1] === 'string') {
      filters.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith('--project=')) {
      filters.push(arg.slice('--project='.length));
    }
  }
  return filters;
};

const shouldProbeFirefox = (config: FullConfig): boolean => {
  const hasFirefoxProject = config.projects.some((project) => project.name === 'firefox');
  if (!hasFirefoxProject) return false;

  const projectFilters = getExplicitProjectFilters();
  if (projectFilters.length === 0) return false;
  return projectFilters.some((filter) => filter.split(',').some((part) => part === 'firefox'));
};

const probeFirefoxLaunchIfSelected = async (config: FullConfig): Promise<void> => {
  if (!shouldProbeFirefox(config)) return;

  try {
    const browser = await firefox.launch({ timeout: FIREFOX_LAUNCH_PROBE_TIMEOUT_MS });
    await browser.close();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Firefox launch probe failed before running E2E test bodies. ` +
        `This is an environment/browser startup failure, not an application assertion failure. ${details}`
    );
  }
};

/**
 * Global setup for E2E tests
 *
 * This runs once before all tests and sets up the testing environment.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting HierarchiDB E2E Test Setup...');
  await probeFirefoxLaunchIfSelected(config);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const serverUrl = config.webServer?.url ?? e2eUrlContract.baseURLWithSlash;
  const skipWebServer = !config.webServer;

  let progressTimer: NodeJS.Timeout | undefined;

  try {
    // Wait for the development server to be ready
    if (skipWebServer) {
      console.log(
        `⏳ PLAYWRIGHT_SKIP_WEBSERVER=1 が設定済み。既存サーバー (${serverUrl}) への接続を試みます。`
      );
    } else {
      console.log(`⏳ Preview サーバー起動を待機中 (${serverUrl})...`);
    }

    progressTimer = setInterval(() => {
      console.log(`   … ${new Date().toLocaleTimeString()} 時点: サーバー応答待ち`);
    }, 15000);

    await waitForServerReady(serverUrl, SERVER_READY_TIMEOUT_MS);

    await page.goto(serverUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    clearInterval(progressTimer);

    // Check if the _app is loaded properly - just wait for page to load
    // Remove _app-root check as it doesn't exist in current implementation
    console.log('✅ Page loaded successfully');

    // Initialize test database if needed
    await page.evaluate(() => {
      // Clear any existing test data
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        // Clear IndexedDB for clean test atoms
        const clearDB = async () => {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map((db) => {
              if (db.name?.includes('test') || db.name?.includes('e2e')) {
                return new Promise<void>((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!);
                  deleteReq.onsuccess = () => resolve();
                  deleteReq.onerror = () => reject(deleteReq.error);
                });
              }
            })
          );
        };
        return clearDB();
      }
    });

    console.log('🧹 Test database cleaned');

    // Set up test environment flags
    await page.evaluate(() => {
      // Disable animations for more reliable tests
      localStorage.setItem('e2e-test-mode', 'true');
      localStorage.setItem('disable-animations', 'true');
      localStorage.setItem('skip-guided-tour', 'true');
    });

    console.log('⚙️ Test environment configured');
  } catch (error) {
    // ensure timer is cleared if goto failed early
    if (progressTimer) {
      clearInterval(progressTimer);
    }
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;
