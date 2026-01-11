import { chromium, FullConfig } from '@playwright/test';

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

/**
 * Global setup for E2E tests
 *
 * This runs once before all tests and sets up the testing environment.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting HierarchiDB E2E Test Setup...');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const serverUrl = config.webServer?.url ?? baseURLWithSlash;
  const skipWebServer = !config.webServer;

  let progressTimer: NodeJS.Timeout | undefined;

  try {
    // Wait for the development server to be ready
    if (skipWebServer) {
      console.log(`⏳ PLAYWRIGHT_SKIP_WEBSERVER=1 が設定済み。既存サーバー (${serverUrl}) への接続を試みます。`);
    } else {
      console.log(`⏳ Preview サーバー起動を待機中 (${serverUrl})...`);
    }

    progressTimer = setInterval(() => {
      console.log(`   … ${new Date().toLocaleTimeString()} 時点: サーバー応答待ち`);
    }, 15000);

    await page.goto(serverUrl, {
      waitUntil: 'networkidle',
      timeout: 60000,
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
