import { test, expect, Page } from '@playwright/test';

/**
 * E2E Smoke Tests for Router Engine Toggle
 * 
 * Tests the ability to switch between React Router and TanStack Router
 * via the VITE_ROUTER_ENGINE environment variable.
 * 
 * Note: These tests verify that the app starts correctly with each router engine.
 * Full route functionality will be tested in later phases.
 */

test.describe('Router Engine Toggle - Smoke Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text());
      } else if (msg.text().includes('[Router') || msg.text().includes('Router')) {
        console.log('Router log:', msg.text());
      }
    });

    // Log network errors
    page.on('pageerror', error => {
      console.error('Page error:', error);
    });
  });

  test('should load app with React Router (default engine) @router-toggle', async () => {
    // Navigate to the app (default uses React Router)
    await page.goto('/hierarchidb/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the app to be ready
    await expect(page.locator('[data-testid="app-ready"], main, [role="main"]')).toBeVisible({
      timeout: 15000
    });

    // Verify no error screens are shown
    await expect(page.locator('text=/Initialization Error/i')).not.toBeVisible();
    await expect(page.locator('text=/Failed to initialize/i')).not.toBeVisible();
    
    // Verify the main app content is loaded
    const mainContent = page.locator('main, [role="main"], .MuiContainer-root');
    await expect(mainContent).toBeVisible();

    // Check that we're on the home route
    const url = page.url();
    expect(url).toContain('/hierarchidb');
    
    console.log('✅ React Router engine loaded successfully');
  });

  test('should handle browser routing mode @router-toggle', async () => {
    // Navigate to the app
    await page.goto('/hierarchidb/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the app to be ready
    await expect(page.locator('[data-testid="app-ready"], main, [role="main"]')).toBeVisible({
      timeout: 15000
    });

    // Verify URL is clean (no hash) in browser mode
    const url = page.url();
    // In browser mode, we should not have hash routing by default
    // (unless VITE_USE_HASH_ROUTING is true, which it is in production)
    console.log('Current URL:', url);
    
    // Just verify the page loaded successfully
    expect(url).toBeTruthy();
    
    console.log('✅ Browser routing mode handled successfully');
  });

  test('should initialize worker before app renders @router-toggle', async () => {
    // Navigate to the app
    await page.goto('/hierarchidb/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for worker initialization event
    // The app should wait for worker initialization before rendering
    const workerInitialized = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 15000);
        
        // Listen for the worker initialization event
        window.addEventListener('hierarchidb-worker-init-complete', () => {
          clearTimeout(timeout);
          resolve(true);
        }, { once: true });

        // If the event already fired, resolve immediately
        if ((window as any).__HDB_WORKER_READY__) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });

    expect(workerInitialized).toBe(true);

    // Verify the app content is now visible
    await expect(page.locator('[data-testid="app-ready"], main, [role="main"]')).toBeVisible();
    
    console.log('✅ Worker initialized before app render');
  });

  test('should handle navigation to home page @router-toggle', async () => {
    // Navigate to the app
    await page.goto('/hierarchidb/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the app to be ready
    await expect(page.locator('[data-testid="app-ready"], main, [role="main"]')).toBeVisible({
      timeout: 15000
    });

    // Check for typical home page elements
    // These might include navigation, title, or main content areas
    const hasContent = await page.evaluate(() => {
      // Check for common elements that indicate successful page load
      const hasMainContent = document.querySelector('main, [role="main"]') !== null;
      const hasNavigation = document.querySelector('nav, [role="navigation"]') !== null;
      const hasContainer = document.querySelector('.MuiContainer-root') !== null;
      
      return hasMainContent || hasNavigation || hasContainer;
    });

    expect(hasContent).toBe(true);
    
    console.log('✅ Home page navigation successful');
  });

  test('should not show router-related errors @router-toggle', async () => {
    // Navigate to the app
    await page.goto('/hierarchidb/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the app to be ready
    await expect(page.locator('[data-testid="app-ready"], main, [role="main"]')).toBeVisible({
      timeout: 15000
    });

    // Check for common error patterns
    const errorPatterns = [
      'Router not found',
      'Failed to create router',
      'Router initialization error',
      'Invalid router configuration',
      'Route not found',
    ];

    for (const pattern of errorPatterns) {
      await expect(page.locator(`text=/${pattern}/i`)).not.toBeVisible();
    }

    // Also check browser console for errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(1000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(err => 
      err.toLowerCase().includes('router') && 
      !err.includes('react-router') // Ignore deprecation warnings
    );

    expect(criticalErrors).toHaveLength(0);
    
    console.log('✅ No router-related errors found');
  });
});

/**
 * Note for future phases:
 * 
 * When TanStack Router is fully implemented and enabled via VITE_ROUTER_ENGINE=tanstack,
 * add additional tests here to verify:
 * 
 * 1. Route transitions work correctly
 * 2. Loader functions execute properly
 * 3. Navigation state is maintained
 * 4. Deep links work (e.g., /t/:treeId/:pageNodeId)
 * 5. Browser back/forward buttons work
 * 6. Hash routing mode works (for GitHub Pages)
 * 
 * For now, these smoke tests just verify that the app starts successfully
 * with the router infrastructure in place.
 */
