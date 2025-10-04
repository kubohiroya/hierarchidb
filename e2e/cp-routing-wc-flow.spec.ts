import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  moveToTrash,
  waitForSubTreeUpdate,
  waitForWorkingCopyUpdate,
  configureWorkerCmdprocOverride,
  WORKER_CMDPROC_FLAG_NAME,
  WorkerFlagOverrideValue,
  performDragDrop,
  resetWorkerFlagOverrides,
  buildAppUrl,
} from './utils/test-helpers';
import { WORKER_FLAG_OVERRIDES_STORAGE_KEY } from '../app/src/config/worker-flag-overrides.js';

type Scenario = {
  name: string;
  flagValue: WorkerFlagOverrideValue;
};

const SCENARIOS: Scenario[] = [
  { name: 'legacy command path (flag off)', flagValue: '0' },
  { name: 'CommandProcessor path (flag on)', flagValue: '1' },
];

test.describe.serial('CP routing + Working Copy batch flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkerFlagOverrides(page);
  });

  async function runBatchFlow(page: Parameters<typeof test>[0]['page'], scenario: Scenario) {
    setupConsoleErrorTracking(page);

    await configureWorkerCmdprocOverride(page, scenario.flagValue);
    await clearTestData(page);

    await page.goto(buildAppUrl('t/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    const timestamp = Date.now();
    const initialName = await createTestFolder(page, `CP Batch ${timestamp}`);
    const nodeSelector = (name: string) => `[data-testid="tree-node"]:has-text("${name}")`;
    const createdNode = page.locator(nodeSelector(initialName)).first();

    await createdNode.click({ button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
    await page.locator('[data-testid="context-menu-edit"]').click();
    await expect(page.locator('[data-testid="folder-plugin-edit-base-dialog"]')).toBeVisible();

    const renamedName = `${initialName} - updated`;
    const nameInput = page.locator('[data-testid="folder-plugin-name-input"]');
    await nameInput.fill(renamedName);
    await page.locator('[data-testid="edit-folder-plugin-confirm"]').click();
    await waitForWorkingCopyUpdate(page);
    await expect(page.locator(nodeSelector(renamedName))).toBeVisible({ timeout: 10000 });

    const destinationName = await createTestFolder(page, `Destination ${timestamp}`);
    const destinationNode = page.locator(nodeSelector(destinationName)).first();

    await performDragDrop(page, page.locator(nodeSelector(renamedName)).first(), destinationNode);
    await waitForSubTreeUpdate(page);

    const expandButton = destinationNode.locator('[data-testid="expand-button"]');
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await waitForSubTreeUpdate(page);
    }

    const destinationId = await destinationNode.getAttribute('data-node-id');
    if (destinationId) {
      const movedNode = page.locator(
        `[data-testid="tree-node"][data-parent-id="${destinationId}"]:has-text("${renamedName}")`,
      );
      await expect(movedNode).toBeVisible({ timeout: 7000 });
    }

    await moveToTrash(page, renamedName);
    await waitForSubTreeUpdate(page);
    await expect(page.locator(nodeSelector(renamedName))).not.toBeVisible({ timeout: 7000 });

    await page.locator('[data-testid="trash-button"]').click();
    const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${renamedName}")`).first();
    await expect(trashItem).toBeVisible({ timeout: 7000 });

    await trashItem.click({ button: 'right' });
    await expect(page.locator('[data-testid="trash-context-menu"]')).toBeVisible();
    await page.locator('[data-testid="trash-menu-restore"]').click();
    await expect(page.locator('[data-testid="restore-confirmation-base-dialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="confirm-restore"]').click();
    await waitForSubTreeUpdate(page);
    await expect(trashItem).not.toBeVisible({ timeout: 7000 });
    await page.locator('[data-testid="close-trash-panel"]').click();

    const refreshedDestination = page.locator(nodeSelector(destinationName)).first();
    const refreshedExpand = refreshedDestination.locator('[data-testid="expand-button"]');
    if (await refreshedExpand.isVisible()) {
      await refreshedExpand.click();
      await waitForSubTreeUpdate(page);
    }

    const restoredParentId = await refreshedDestination.getAttribute('data-node-id');
    if (restoredParentId) {
      const restoredNode = page.locator(
        `[data-testid="tree-node"][data-parent-id="${restoredParentId}"]:has-text("${renamedName}")`,
      );
      await expect(restoredNode).toBeVisible({ timeout: 7000 });
    } else {
      await expect(page.locator(nodeSelector(renamedName))).toBeVisible({ timeout: 7000 });
    }

    await waitForWorkingCopyUpdate(page);
    const storedOverrides = await page.evaluate(
      (storageKey) => window.localStorage.getItem(storageKey),
      WORKER_FLAG_OVERRIDES_STORAGE_KEY,
    );
    expect(storedOverrides).toBeTruthy();
    if (storedOverrides) {
      const parsed = JSON.parse(storedOverrides) as Record<string, string>;
      expect(parsed[WORKER_CMDPROC_FLAG_NAME]).toBe(scenario.flagValue);
    }
  }

  for (const scenario of SCENARIOS) {
    test(`end-to-end operations succeed via ${scenario.name}`, async ({ page }) => {
      await runBatchFlow(page, scenario);
    });
  }
});
