import { Page, Locator, expect } from '@playwright/test';
export type CreateMenuMatcher = string | RegExp;
const normalizeBasePath = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^\/+|\/+$/g, '');
};

const appName = normalizeBasePath(process.env.VITE_APP_NAME ?? process.env.PLAYWRIGHT_APP_NAME);
const defaultBaseURL = (() => {
  const basePath = appName ? `/${appName}` : '';
  return `http://localhost:4200${basePath}`;
})();

const rawBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL;
const rawRouterMode = process.env.PLAYWRIGHT_ROUTER_MODE ?? process.env.VITE_ROUTER_MODE ?? (process.env.VITE_USE_HASH_ROUTING === 'false' ? 'browser' : 'hash');
const normalizedRouterMode = typeof rawRouterMode === 'string' ? rawRouterMode.toLowerCase() : 'hash';
const IS_HASH_ROUTER = normalizedRouterMode !== 'browser';

export const APP_BASE_URL = rawBaseURL.replace(/\/*$/, '');

export const APP_BASE_URL_WITH_SLASH = `${APP_BASE_URL}/`;

const toHashPath = (input: string): string => {
  if (!input) return '#/';
  if (input.startsWith('#')) {
    const trimmed = input.replace(/^#+/, '');
    if (!trimmed) return '#/';
    return `#/${trimmed.replace(/^\/+/,'')}`;
  }
  return `#/${input.replace(/^\/+/,'')}`;
};

export const buildAppUrl = (path = ''): string => {
  if (IS_HASH_ROUTER) {
    const hashPath = toHashPath(path);
    return `${APP_BASE_URL_WITH_SLASH}${hashPath}`;
  }

  if (!path) return APP_BASE_URL_WITH_SLASH;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('#')) {
    return `${APP_BASE_URL_WITH_SLASH}${path}`;
  }

  if (path.startsWith('/')) {
    return `${APP_BASE_URL}${path}`;
  }

  return `${APP_BASE_URL_WITH_SLASH}${path}`;
};

/**
 * E2E Test Helper Functions
 *
 * Common utilities for HierarchiDB E2E tests
 */

/**
 * Dismisses the guided tour if it's shown
 */
export async function dismissGuidedTour(page: Page): Promise<void> {
  try {
    // Check if guided tour is present
    const tourModal = page.locator('[data-testid="guided-tour-modal"]');
    if (await tourModal.isVisible({ timeout: 2000 })) {
      await page.locator('[data-testid="skip-tour-button"]').click();
      await expect(tourModal).not.toBeVisible();
    }
  } catch {
    // Tour might not be present, continue
  }
}

/**
 * Waits for the TreeTable to fully load
 */
export async function waitForTreeTableLoad(page: Page): Promise<void> {
  const treeTable = page.locator('[data-testid="console-table"], [data-tour-id="tree-table"]').first();

  await expect.poll(async () => {
    const tableVisible = await treeTable.isVisible().catch(() => false);
    if (tableVisible) return 'ready';

    const navigateToResourcesButton = page.getByRole('button', { name: /Navigate to Resources view/i });
    const canNavigateToResources = await navigateToResourcesButton.isVisible().catch(() => false);
    if (canNavigateToResources) {
      await navigateToResourcesButton.click({ force: true }).catch(() => {
        // No-op: retry on next poll tick.
      });
    }
    return 'waiting';
  }, {
    timeout: 30000,
    intervals: [200, 500, 1000],
  }).toBe('ready');

  // Wait for loading indicators to disappear
  await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();

  // Wait for at least one row to be present (or empty atoms)
  await page.waitForFunction(
    () => {
      const table = document.querySelector('[data-testid="console-table"], [data-tour-id="tree-table"]');
      const rows = table?.querySelectorAll('tr');
      const emptyState = table?.querySelector('[data-testid="empty-atoms"]');
      const hasNoData = table?.textContent?.includes('No data');
      return (rows && rows.length > 1) || emptyState || hasNoData;
    },
    { timeout: 10000 }
  );
}

function resolveCreateMenuButton(page: Page) {
  return page.getByRole('button', { name: /^作成$/ }).or(page.getByRole('button', { name: /Create new item/i }));
}

async function findActiveMenuItems(page: Page) {
  const menuContainer = page.locator('[role="menu"]');
  const menuCount = await menuContainer.count();
  const itemSelectors = '[role="menuitem"], [role="option"], [role="presentation"] button, button';
  if (menuCount === 0) {
    return page.locator(itemSelectors);
  }
  return menuContainer.nth(Math.max(menuCount - 1, 0)).locator(itemSelectors);
}

function resolveSubmenuTrigger(item: Locator) {
  return item.locator('button[aria-label*="submenu trigger" i]').or(item.locator('[data-testid$="-submenu-trigger"]'));
}

async function drillCreateMenu(
  page: Page,
  currentMenuItem: Locator,
  options: {
    label: CreateMenuMatcher;
    maxDepth: number;
  }
): Promise<void> {
  const { label, maxDepth } = options;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    const trigger = resolveSubmenuTrigger(currentMenuItem).first();
    const hasSubmenuTrigger = await trigger.isVisible().catch(() => false);

    if (!hasSubmenuTrigger) {
      await currentMenuItem.click();
      return;
    }

    await trigger.dispatchEvent('mouseenter');
    await trigger.dispatchEvent('mouseover');
    await page.waitForTimeout(200);

    const subMenuItems = await findActiveMenuItems(page);
    const nextMenuItem = subMenuItems.filter({ hasText: label }).first();
    if (await nextMenuItem.isVisible().catch(() => false)) {
      currentMenuItem = nextMenuItem;
      continue;
    }

    const fallbackItem = subMenuItems.first();
    if (await fallbackItem.isVisible().catch(() => false)) {
      currentMenuItem = fallbackItem;
      continue;
    }

    await currentMenuItem.click();
    return;
  }

  await currentMenuItem.click();
}

/**
 * Open nested create menu items from SpeedDial / create FAB and drill into
 * submenu nodes up to the provided depth.
 */
export async function openCreateMenuNode(
  page: Page,
  options: {
    /** Label of the target node in current menu level */
    label: CreateMenuMatcher;
    /** How many nested submenu levels to try (defaults to 3). */
    maxDepth?: number;
  }
): Promise<void> {
  const { label, maxDepth = 3 } = options;

  const createMenuButton = resolveCreateMenuButton(page);
  await expect(createMenuButton).toBeVisible({ timeout: 5000 });
  await createMenuButton.first().click();

  const initialMenuItems = await findActiveMenuItems(page);
  let currentMenuItem = initialMenuItems.filter({ hasText: label }).first();
  if (!(await currentMenuItem.isVisible().catch(() => false))) {
    const anyMenuItem = initialMenuItems.first();
    if (await anyMenuItem.isVisible().catch(() => false)) {
      currentMenuItem = anyMenuItem;
    }
  }
  await expect(currentMenuItem).toBeVisible({ timeout: 5000 });

  await drillCreateMenu(page, currentMenuItem, { label, maxDepth });
}

/**
 * Open the create flow for Folder nodes from nested create menu.
 */
export async function openFolderCreateDialog(page: Page): Promise<void> {
  await openCreateMenuNode(page, { label: /^フォルダー|^Folder|^folder/i });
}

/**
 * Open nested create menu items from a context menu.
 */
export async function openContextCreateMenuNode(
  page: Page,
  parentNode: Locator,
  options: {
    /** Label of the target node in current menu level */
    label: CreateMenuMatcher;
    /** How many nested submenu levels to try (defaults to 3). */
    maxDepth?: number;
  }
): Promise<void> {
  const { label, maxDepth = 3 } = options;

  await parentNode.click({ button: 'right' });
  const contextMenu = page.locator('[data-testid="context-menu"]').or(page.locator('[role="menu"]'));
  await expect(contextMenu).toBeVisible({ timeout: 5000 });

  const createTrigger = page
    .locator('[data-testid="context-menu-create"]')
    .or(page.locator('[role="menuitem"]').filter({ hasText: /^作成|^Create/ }))
    .or(page.locator('[role="menu"] button').filter({ hasText: /^作成|^Create/ }))
    .first();
  await expect(createTrigger).toBeVisible({ timeout: 5000 });

  const submenuTrigger = resolveSubmenuTrigger(createTrigger);
  const hasSubmenu = await submenuTrigger.first().isVisible().catch(() => false);
  if (!hasSubmenu) {
    await createTrigger.click();
    return;
  }

  await submenuTrigger.first().dispatchEvent('mouseenter');
  await submenuTrigger.first().dispatchEvent('mouseover');
  await page.waitForTimeout(200);

  const subMenuItems = await findActiveMenuItems(page);
  let targetMenuItem = subMenuItems.filter({ hasText: label }).first();
  if (!(await targetMenuItem.isVisible().catch(() => false))) {
    targetMenuItem = subMenuItems.first();
  }
  await expect(targetMenuItem).toBeVisible({ timeout: 5000 });

  await drillCreateMenu(page, targetMenuItem, { label, maxDepth });
}

/**
 * Creates a test folder-plugin with a unique name
 */
export async function createTestFolder(page: Page, baseName: string): Promise<string> {
  const timestamp = Date.now();
  const folderName = `${baseName} ${timestamp}`;
  const folderDescription = `Automated description for ${folderName}`;

  // Ensure main console is ready
  await waitForTreeTableLoad(page);

  await openFolderCreateDialog(page);

  const dialog = page
    .locator('dialog')
    .filter({
      has: page.getByRole('heading', { name: /Folderの作成|Folderの新規作成|Create Folder|Create New Folder/ }),
    });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog
    .getByLabel(/Folder Name|名称|Name/)
    .or(dialog.locator('[data-testid="folder-plugin-name-input"]'))
    .fill(folderName);

  const descriptionField = dialog.getByLabel(/Description/i);
  if (await descriptionField.isVisible().catch(() => false)) {
    await descriptionField.fill(folderDescription);
  }

  const createButton = dialog.getByRole('button', { name: /Create Folder|Create|作成|保存/ });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  const newNode = page.locator('[data-testid="console-node"]').filter({ hasText: folderName }).first();
  await expect(newNode).toBeVisible({ timeout: 10000 });

  console.log('SpeedDial folder creation flow completed successfully');

  return folderName;
}

export async function waitForRouteProgress(page: Page) {
  const card = page.locator('[data-testid="route-progress-card"]');
  await expect(card).toBeVisible({ timeout: 15000 });

  return {
    card,
    percentage: card.locator('[data-testid="route-progress-percentage"]'),
    stage: card.locator('[data-testid="route-progress-stage"]'),
    failedCount: card.locator('[data-testid="route-progress-failed-count"]'),
    lastError: card.locator('[data-testid="route-progress-last-error"]'),
    toggleButton: card.locator('[data-testid="route-progress-toggle"]'),
  };
}

/**
 * Creates a child folder-plugin under a parent node
 */
export async function createChildFolder(
  page: Page,
  parentNode: Locator,
  baseName: string
): Promise<string> {
  const timestamp = Date.now();
  const folderName = `${baseName} ${timestamp}`;

  await openContextCreateMenuNode(page, parentNode, {
    label: /^フォルダー|^Folder|^folder/i,
  });

  // Fill base-dialog
  await expect(page.locator('[data-testid="folder-plugin-create-base-dialog"]')).toBeVisible();
  await page.locator('[data-testid="folder-plugin-name-input"]').fill(folderName);
  await page.locator('[data-testid="create-folder-plugin-confirm"]').click();

  // Wait for creation
  await expect(page.locator('[data-testid="folder-plugin-create-base-dialog"]')).not.toBeVisible();

  return folderName;
}

/**
 * Moves a folder-plugin to archive
 */
export async function moveToArchive(page: Page, folderName: string): Promise<void> {
  const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
  await folderNode.click({ button: 'right' });

  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  await page.locator('[data-testid="context-menu-remove"]').click();

  // Confirm deletion
  await expect(page.locator('[data-testid="archive-confirmation-base-dialog"]')).toBeVisible();
  await page.locator('[data-testid="confirm-archive"]').click();

  // Wait for folder-plugin to disappear from main view
  await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).not.toBeVisible(
    { timeout: 5000 }
  );
}

/**
 * Renames a folder-plugin via context menu and returns the generated name.
 */
export async function renameFolder(
  page: Page,
  currentName: string,
  baseName: string
): Promise<string> {
  const timestamp = Date.now();
  const nextName = `${baseName} ${timestamp}`;

  const folderNode = page
    .locator('[data-testid="console-node"]')
    .filter({ hasText: currentName })
    .first();
  await expect(folderNode).toBeVisible({ timeout: 5000 });

  await folderNode.click({ button: 'right' });
  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  await page.locator('[data-testid="context-menu-edit"]').click();

  const dialog = page.locator('[data-testid="folder-plugin-edit-base-dialog"]');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  const nameInput = dialog.locator('[data-testid="folder-plugin-name-input"]');
  await nameInput.fill(nextName);

  await dialog.locator('[data-testid="edit-folder-plugin-confirm"]').click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  await waitForDraftUpdate(page);
  await expect(
    page.locator('[data-testid="console-node"]').filter({ hasText: nextName }).first()
  ).toBeVisible({ timeout: 5000 });

  return nextName;
}

/**
 * Restores a folder from the archive panel back to the main console.
 */
export async function restoreFromArchive(page: Page, folderName: string): Promise<void> {
  const archiveButton = page.locator('[data-testid="archive-button"]');
  await archiveButton.click();

  const archivePanel = page.locator('[data-testid="archive-panel"]');
  await expect(archivePanel).toBeVisible({ timeout: 5000 });

  const archiveItem = archivePanel.locator('[data-testid="archive-item"]').filter({ hasText: folderName }).first();
  await expect(archiveItem).toBeVisible({ timeout: 5000 });

  await archiveItem.click({ button: 'right' });
  await expect(page.locator('[data-testid="archive-context-menu"]')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="archive-menu-restore"]').click();

  const confirmationDialog = page.locator('[data-testid="restore-confirmation-base-dialog"]');
  await expect(confirmationDialog).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="confirm-restore"]').click();
  await expect(confirmationDialog).not.toBeVisible({ timeout: 5000 });

  await page.locator('[data-testid="close-archive-panel"]').click();
  await expect(archivePanel).not.toBeVisible({ timeout: 5000 });

  await waitForDraftUpdate(page);
}

/**
 * Performs drag and drop operation between two elements
 */
export async function performDragDrop(page: Page, source: Locator, target: Locator): Promise<void> {
  // Get bounding boxes for precise drag and drop
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding boxes for drag and drop');
  }

  // Start drag
  await source.hover();
  await page.mouse.down();

  // Drag to target
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 10 } // Smooth movement
  );

  // Drop
  await page.mouse.up();
}

/**
 * Waits for SubTree updates to complete
 */
export async function waitForSubTreeUpdate(page: Page, timeout: number = 3000): Promise<void> {
  // Wait for any pending SubTree subscription updates
  await page.waitForFunction(
    () => {
      // Check if there are any pending updates
      const updateIndicator = document.querySelector('[data-testid="subtree-updating"]');
      return !updateIndicator || !updateIndicator.hasAttribute('data-updating');
    },
    { timeout }
  );

  // Small additional wait for DOM updates
  await page.waitForTimeout(100);
}

/**
 * Selects multiple nodes using Ctrl+Click
 */
export async function selectMultipleNodes(page: Page, nodeSelectors: string[]): Promise<void> {
  await page.keyboard.down('Control');

  for (const selector of nodeSelectors) {
    await page.locator(selector).click();
  }

  await page.keyboard.up('Control');

  // Verify selection count
  const expectedCount = nodeSelectors.length;
  await expect(page.locator('[data-testid="selected-count"]')).toHaveText(
    `${expectedCount} items selected`
  );
}

/**
 * Waits for Working Copy operations to complete
 */
export async function waitForDraftUpdate(page: Page): Promise<void> {
  // Wait for Working Copy indicator to appear and then stabilize
  try {
    await expect(page.locator('[data-testid="draft-indicator"]')).toBeVisible({
      timeout: 2000,
    });
  } catch {
    // Working Copy indicator might not appear for simple operations
  }

  // Wait for any saving atoms to complete
  await page.waitForFunction(
    () => {
      const savingIndicator = document.querySelector('[data-testid="saving-indicator"]');
      return !savingIndicator || savingIndicator.getAttribute('data-saving') !== 'true';
    },
    { timeout: 5000 }
  );

  // Allow any follow-up UI refresh to settle
  await page.waitForTimeout(100);
}

/**
 * Clicks the toolbar Undo button and waits for the operation to settle.
 */
export async function clickUndo(page: Page): Promise<void> {
  const undoButton = page.locator('[data-testid="treeconsole-toolbar-undo-button"]');
  await expect(undoButton).toBeEnabled({ timeout: 5000 });
  await undoButton.click();
  await waitForDraftUpdate(page);
}

/**
 * Clicks the toolbar Redo button and waits for the operation to settle.
 */
export async function clickRedo(page: Page): Promise<void> {
  const redoButton = page.locator('[data-testid="treeconsole-toolbar-redo-button"]');
  await expect(redoButton).toBeEnabled({ timeout: 5000 });
  await redoButton.click();
  await waitForDraftUpdate(page);
}

/**
 * Clears all test data for a clean test atoms
 */
export async function clearTestData(page: Page): Promise<void> {
  // Try to clear test data, but ignore errors if running in restricted context
  try {
    await page.evaluate(async () => {
      // Clear localStorage test data - with try/catch for security errors
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('test') || key.includes('e2e'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        // Ignore localStorage access errors in test environment
        console.warn('Could not access localStorage:', e);
      }

      // Clear IndexedDB test databases
      try {
        if ('indexedDB' in window && indexedDB.databases) {
          const databases = await indexedDB.databases();
          await Promise.all(
            databases.map((db) => {
              if (db.name && (db.name.includes('test') || db.name.includes('e2e'))) {
                return new Promise<void>((resolve, reject) => {
                  const deleteReq = indexedDB.deleteDatabase(db.name!);
                  deleteReq.onsuccess = () => resolve();
                  deleteReq.onerror = () => reject(deleteReq.error);
                });
              }
            })
          );
        }
      } catch (e) {
        // Ignore IndexedDB access errors in test environment
        console.warn('Could not access IndexedDB:', e);
      }
    });
  } catch (e) {
    // Ignore all errors - test can proceed without clearing data
    console.warn('Could not clear test data:', e);
  }
}

/**
 * Sets up test data for specific test scenarios
 */
export async function setupTestData(
  page: Page,
  scenario: 'basic' | 'complex' | 'performance'
): Promise<void> {
  await page.evaluate((testScenario) => {
    // Set up different test data sets based on scenario
    const testData = {
      basic: {
        folderCount: 5,
        maxDepth: 2,
      },
      complex: {
        folderCount: 20,
        maxDepth: 4,
      },
      performance: {
        folderCount: 100,
        maxDepth: 6,
      },
    };

    localStorage.setItem('e2e-test-scenario', testScenario);
    localStorage.setItem(
      'e2e-test-data',
      JSON.stringify(testData[testScenario as keyof typeof testData])
    );
  }, scenario);
}

/**
 * Waits for animations to complete
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if any CSS animations or transitions are running
      const elements = document.querySelectorAll('*');
      elements.forEach (element =>{
        const computedStyle = getComputedStyle(element);
        if (computedStyle.animationName !== 'none' || computedStyle.transitionDuration !== '0s') {
          return false;
        }
      });
      return true;
    },
    { timeout: 5000 }
  );
}

/**
 * Takes a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${name}.png`;

  await page.screenshot({
    path: `e2e-results/screenshots/${filename}`,
    fullPage: options?.fullPage || false,
  });
}

/**
 * Checks for console errors and logs them
 */
export function setupConsoleErrorTracking(page: Page): void {
  page.on('console', async (msg) => {
    if (msg.type() === 'error') {
      let serializedArgs: unknown[] = [];
      try {
        serializedArgs = await Promise.all(
          msg.args().map(async (arg) => {
            try {
              return await arg.jsonValue();
            } catch (serializationError) {
              return `<unserializable: ${serializationError}>`;
            }
          }),
        );
      } catch (serializationError) {
        serializedArgs = [`<args unavailable: ${serializationError}>`];
      }
      console.error('Console error:', msg.text(), serializedArgs);
    }
  });

  page.on('pageerror', (error) => {
    const errorDetails = error?.stack ?? error?.message ?? String(error);
    console.error('Page error:', errorDetails);
  });
}

/**
 * Validates accessibility attributes
 */
export async function validateAccessibility(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);

  // Check for required ARIA attributes
  const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === 'button') {
    await expect(element).toHaveAttribute('aria-label');
  }

  if (tagName === 'input') {
    await expect(element).toHaveAttribute('aria-label');
  }

  // Check for keyboard accessibility
  await element.focus();
  await expect(element).toBeFocused();
}
