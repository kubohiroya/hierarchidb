import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 *
 * This runs once before all tests and sets up the testing environment.
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting HierarchiDB E2E Test Setup...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the development server to be ready
    console.log('⏳ Waiting for development server...');
    await page.goto(config.webServer?.url || 'http://localhost:4200', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Check if the app is loaded properly - just wait for page to load
    // Remove app-root check as it doesn't exist in current implementation
    console.log('✅ Page loaded successfully');

    // Initialize test database if needed
    await page.evaluate(() => {
      // Clear any existing test data
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        // Clear IndexedDB for clean test state
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
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;
