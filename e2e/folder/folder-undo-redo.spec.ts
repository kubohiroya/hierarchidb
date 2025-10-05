import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  renameFolder,
  moveToTrash,
  restoreFromTrash,
  waitForWorkingCopyUpdate,
  clickUndo,
  clickRedo,
  configureWorkerCmdprocOverride,
  WORKER_CMDPROC_FLAG_NAME,
  WorkerFlagOverrideValue,
  resetWorkerFlagOverrides,
  buildAppUrl,
} from '../utils/test-helpers';
import { WORKER_FLAG_OVERRIDES_STORAGE_KEY } from '../../app/src/config/worker-flag-overrides.js';

/**
 * Folder Undo/Redo E2E Test
 *
 * Validates that the undo/redo stack captures create, rename, trash, and restore
 * operations in the expected order and that UI state reflects each transition.
 */

type Scenario = {
  name: string;
  flagValue: WorkerFlagOverrideValue;
  skip?: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    name: 'legacy command path (flag off)',
    flagValue: '0',
    // Legacy経路はサンセット対象。最新実装（flag on）が安定運用に入ったため自動テストはスキップ。
    skip: true,
  },
  { name: 'CommandProcessor path (flag on)', flagValue: '1' },
];

test.describe.serial('Folder Undo/Redo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkerFlagOverrides(page);
  });

  async function runUndoRedoCycle(page: Parameters<typeof test>[0]['page'], scenario: Scenario) {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await configureWorkerCmdprocOverride(page, scenario.flagValue);

    await page.goto(buildAppUrl('t/r'));

    const dialog = page.locator('[role="base-dialog"]');
    if (await dialog.isVisible()) {
      const closeButton = dialog.locator('button[aria-label="close"]').or(dialog.locator('text=Cancel'));
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    await dismissGuidedTour(page);
    await page.waitForLoadState('networkidle');
    await waitForTreeTableLoad(page);

    const originalName = await createTestFolder(page, 'UndoRedo Folder');
    const renamedName = await renameFolder(page, originalName, 'UndoRedo Renamed');

    await moveToTrash(page, renamedName);
    await waitForWorkingCopyUpdate(page);
    await restoreFromTrash(page, renamedName);

    const treeNode = (name: string) =>
      page.locator('[data-testid="tree-node"]').filter({ hasText: name }).first();
    const trashItem = (name: string) =>
      page.locator('[data-testid="trash-item"]').filter({ hasText: name }).first();

    const expectInTrash = async (name: string) => {
      await page.locator('[data-testid="trash-button"]').click();
      const trashPanel = page.locator('[data-testid="trash-panel"]');
      await expect(trashPanel).toBeVisible({ timeout: 5000 });
      await expect(trashItem(name)).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="close-trash-panel"]').click();
      await expect(trashPanel).not.toBeVisible({ timeout: 5000 });
    };

    const expectNotInTrash = async (name: string) => {
      await page.locator('[data-testid="trash-button"]').click();
      const trashPanel = page.locator('[data-testid="trash-panel"]');
      await expect(trashPanel).toBeVisible({ timeout: 5000 });
      await expect(trashItem(name)).toHaveCount(0);
      await page.locator('[data-testid="close-trash-panel"]').click();
      await expect(trashPanel).not.toBeVisible({ timeout: 5000 });
    };

    // Baseline: node restored to main tree and absent from trash
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInTrash(renamedName);

    // Undo restore → node back into trash
    await clickUndo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInTrash(renamedName);

    // Undo remove → node returns to tree with renamed state
    await clickUndo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInTrash(renamedName);

    // Undo rename → original name restored
    await clickUndo(page);
    await expect(treeNode(originalName)).toBeVisible({ timeout: 5000 });
    await expect(treeNode(renamedName)).toHaveCount(0);

    // Undo create → node fully removed
    await clickUndo(page);
    await expect(treeNode(originalName)).toHaveCount(0);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectNotInTrash(renamedName);

    // Redo create → original node returns
    await clickRedo(page);
    await expect(treeNode(originalName)).toBeVisible({ timeout: 5000 });

    // Redo rename → node reflects renamed state
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expect(treeNode(originalName)).toHaveCount(0);

    // Redo remove → node moves to trash
    await clickRedo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInTrash(renamedName);

    // Redo restore → node back to tree, trash cleared
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInTrash(renamedName);

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
    const runner = scenario.skip ? test.skip : test;
    runner(`create → rename → trash → restore supports undo/redo cycle via ${scenario.name}`, async ({ page }) => {
      await runUndoRedoCycle(page, scenario);
    });
  }
});
