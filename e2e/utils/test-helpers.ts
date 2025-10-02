import { Page, Locator, expect } from '@playwright/test';
import {
  WORKER_FLAG_OVERRIDES_STORAGE_KEY,
  WORKER_FLAG_ALLOWED_OVERRIDES,
} from '../../app/src/config/worker-flag-overrides.js';
import {
  createWorkerFlagOverrideLifecycle,
  type WorkerFlagOverrideMap,
  type WorkerFlagOverrideSetting,
} from '../../packages/runtime/worker/src/e2e/utils/worker-flag-helpers.js';

export type WorkerFlagOverrideValue = WorkerFlagOverrideSetting;

if (!WORKER_FLAG_ALLOWED_OVERRIDES.includes('WORKER_USE_CMDPROC_MOVE_REMOVE')) {
  throw new Error('WORKER_USE_CMDPROC_MOVE_REMOVE flag must be included in WORKER_FLAG_ALLOWED_OVERRIDES');
}

export const WORKER_CMDPROC_FLAG_NAME = 'WORKER_USE_CMDPROC_MOVE_REMOVE';

const workerFlagLifecycle = createWorkerFlagOverrideLifecycle();
let activeOverrideCleanup: (() => void) | null = null;

export async function configureWorkerCmdprocOverride(
  page: Page,
  value: WorkerFlagOverrideValue,
): Promise<void> {
  if (activeOverrideCleanup) {
    activeOverrideCleanup();
    activeOverrideCleanup = null;
  }

  const overrides: WorkerFlagOverrideMap =
    value === '0' || value === '1' ? { [WORKER_CMDPROC_FLAG_NAME]: value } : {};

  if (value === '0' || value === '1') {
    activeOverrideCleanup = workerFlagLifecycle.applyEnvOverrides(overrides);
  } else {
    workerFlagLifecycle.resetEnv();
  }

  const payload = workerFlagLifecycle.createPayload(overrides);
  await page.addInitScript(
    ({ storageKey, payload: serialized }: { storageKey: string; payload: string | null }) => {
      try {
        if (serialized) {
          window.localStorage.setItem(storageKey, serialized);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.warn('[e2e] failed to configure worker flag override', error);
      }
    },
    { storageKey: WORKER_FLAG_OVERRIDES_STORAGE_KEY, payload },
  );
  await page.evaluate(
    ({ storageKey, payload: serialized }: { storageKey: string; payload: string | null }) => {
      if (serialized) {
        window.localStorage.setItem(storageKey, serialized);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    },
    { storageKey: WORKER_FLAG_OVERRIDES_STORAGE_KEY, payload },
  );
}

export async function resetWorkerFlagOverrides(page: Page): Promise<void> {
  await configureWorkerCmdprocOverride(page, null);
  if (activeOverrideCleanup) {
    activeOverrideCleanup();
    activeOverrideCleanup = null;
  } else {
    workerFlagLifecycle.resetEnv();
  }
}

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
  } catch (error) {
    // Tour might not be present, continue
  }
}

/**
 * Waits for the TreeTable to fully load
 */
export async function waitForTreeTableLoad(page: Page): Promise<void> {
  // Wait for the main TreeTable component
  await expect(page.locator('[data-testid="tree-table"]')).toBeVisible();

  // Wait for loading indicators to disappear
  await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();

  // Wait for at least one row to be present (or empty state)
  await page.waitForFunction(
    () => {
      const table = document.querySelector('[data-testid="tree-table"]');
      const rows = table?.querySelectorAll('[data-testid="tree-table-row"]');
      const emptyState = table?.querySelector('[data-testid="empty-state"]');
      return (rows && rows.length > 0) || emptyState;
    },
    { timeout: 10000 }
  );
}

/**
 * Creates a test folder-plugin with a unique name
 */
export async function createTestFolder(page: Page, baseName: string): Promise<string> {
  const timestamp = Date.now();
  const folderName = `${baseName} ${timestamp}`;
  const folderDescription = `Automated description for ${folderName}`;

  // Ensure main tree is ready
  await waitForTreeTableLoad(page);

  // Open SpeedDial menu (Floating Action Button labelled "Create new item")
  const speedDialButton = page.getByRole('button', { name: /Create new item/i });
  if (!(await speedDialButton.isVisible())) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
  }
  await speedDialButton.click({ force: true });

  // Select "Create Folder" SpeedDial action
  const createFolderAction = page.getByRole('button', { name: /Create Folder/i });
  await expect(createFolderAction).toBeVisible({ timeout: 5000 });
  await createFolderAction.click();

  // Interact with the folder creation dialog
  const dialog = page.getByRole('dialog', { name: /Create New Folder/i });
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog.getByLabel(/Folder Name/i).fill(folderName);

  const descriptionField = dialog.getByLabel(/Description/i);
  if (await descriptionField.isVisible()) {
    await descriptionField.fill(folderDescription);
  }

  const createButton = dialog.getByRole('button', { name: /Create Folder/i });
  await expect(createButton).toBeEnabled();
  await createButton.click();

  await expect(dialog).not.toBeVisible({ timeout: 5000 });

  const newNode = page.locator('[data-testid="tree-node"]').filter({ hasText: folderName }).first();
  await expect(newNode).toBeVisible({ timeout: 10000 });

  console.log('SpeedDial folder creation flow completed successfully');

  return folderName;
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

  // Right-click on parent to open context menu
  await parentNode.click({ button: 'right' });
  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

  // Navigate to Create submenu
  await page.locator('[data-testid="context-menu-create"]').hover();
  await expect(page.locator('[data-testid="create-submenu"]')).toBeVisible();

  // Click folder-plugin creation
  await page.locator('[data-testid="create-submenu-folder-plugin"]').click();

  // Fill base-dialog
  await expect(page.locator('[data-testid="folder-plugin-create-base-dialog"]')).toBeVisible();
  await page.locator('[data-testid="folder-plugin-name-input"]').fill(folderName);
  await page.locator('[data-testid="create-folder-plugin-confirm"]').click();

  // Wait for creation
  await expect(page.locator('[data-testid="folder-plugin-create-base-dialog"]')).not.toBeVisible();

  return folderName;
}

/**
 * Moves a folder-plugin to trash
 */
export async function moveToTrash(page: Page, folderName: string): Promise<void> {
  const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
  await folderNode.click({ button: 'right' });

  await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  await page.locator('[data-testid="context-menu-remove"]').click();

  // Confirm deletion
  await expect(page.locator('[data-testid="trash-confirmation-base-dialog"]')).toBeVisible();
  await page.locator('[data-testid="confirm-trash"]').click();

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
    .locator('[data-testid="tree-node"]')
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

  await waitForWorkingCopyUpdate(page);
  await expect(
    page.locator('[data-testid="tree-node"]').filter({ hasText: nextName }).first()
  ).toBeVisible({ timeout: 5000 });

  return nextName;
}

/**
 * Restores a folder from the trash panel back to the main tree.
 */
export async function restoreFromTrash(page: Page, folderName: string): Promise<void> {
  const trashButton = page.locator('[data-testid="trash-button"]');
  await trashButton.click();

  const trashPanel = page.locator('[data-testid="trash-panel"]');
  await expect(trashPanel).toBeVisible({ timeout: 5000 });

  const trashItem = trashPanel.locator('[data-testid="trash-item"]').filter({ hasText: folderName }).first();
  await expect(trashItem).toBeVisible({ timeout: 5000 });

  await trashItem.click({ button: 'right' });
  await expect(page.locator('[data-testid="trash-context-menu"]')).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="trash-menu-restore"]').click();

  const confirmationDialog = page.locator('[data-testid="restore-confirmation-base-dialog"]');
  await expect(confirmationDialog).toBeVisible({ timeout: 5000 });
  await page.locator('[data-testid="confirm-restore"]').click();
  await expect(confirmationDialog).not.toBeVisible({ timeout: 5000 });

  await page.locator('[data-testid="close-trash-panel"]').click();
  await expect(trashPanel).not.toBeVisible({ timeout: 5000 });

  await waitForWorkingCopyUpdate(page);
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
export async function waitForWorkingCopyUpdate(page: Page): Promise<void> {
  // Wait for Working Copy indicator to appear and then stabilize
  try {
    await expect(page.locator('[data-testid="working-copy-indicator"]')).toBeVisible({
      timeout: 2000,
    });
  } catch {
    // Working Copy indicator might not appear for simple operations
  }

  // Wait for any saving state to complete
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
  await waitForWorkingCopyUpdate(page);
}

/**
 * Clicks the toolbar Redo button and waits for the operation to settle.
 */
export async function clickRedo(page: Page): Promise<void> {
  const redoButton = page.locator('[data-testid="treeconsole-toolbar-redo-button"]');
  await expect(redoButton).toBeEnabled({ timeout: 5000 });
  await redoButton.click();
  await waitForWorkingCopyUpdate(page);
}

/**
 * Clears all test data for a clean test state
 */
export async function clearTestData(page: Page): Promise<void> {
  // Try to clear test data, but ignore errors if running in restricted context
  try {
    await page.evaluate(async (storageKey) => {
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
        localStorage.removeItem(storageKey);
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
    }, WORKER_FLAG_OVERRIDES_STORAGE_KEY);
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
      for (const element of elements) {
        const computedStyle = getComputedStyle(element);
        if (computedStyle.animationName !== 'none' || computedStyle.transitionDuration !== '0s') {
          return false;
        }
      }
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
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('Console error:', msg.text());
    }
  });

  page.on('pageerror', (error) => {
    console.error('Page error:', error.message);
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
