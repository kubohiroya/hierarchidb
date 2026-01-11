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
  waitForDraftUpdate,
  clickUndo,
  clickRedo,
  buildAppUrl,
} from '../utils/test-helpers';

/**
 * Folder Undo/Redo E2E Test
 *
 * Validates that the undo/redo stack captures create, rename, trash, and restore
 * operations in the expected order and that UI atoms reflects each transition.
 */

test.describe.serial('Folder Undo/Redo Flow', () => {
  async function runUndoRedoCycle(page: Parameters<typeof test>[0]['page']) {
    setupConsoleErrorTracking(page);
    await clearTestData(page);

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
    await waitForDraftUpdate(page);
    await restoreFromTrash(page, renamedName);

    const treeNode = (name: string) =>
      page.locator('[data-testid="console-node"]').filter({ hasText: name }).first();
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

    // Baseline: node restored to main console and absent from trash
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInTrash(renamedName);

    // Undo restore → node back into trash
    await clickUndo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInTrash(renamedName);

    // Undo remove → node returns to console with renamed atoms
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

    // Redo rename → node reflects renamed atoms
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expect(treeNode(originalName)).toHaveCount(0);

    // Redo remove → node moves to trash
    await clickRedo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInTrash(renamedName);

    // Redo restore → node back to console, trash cleared
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInTrash(renamedName);
  }

  test('create → rename → trash → restore supports undo/redo cycle with CommandProcessor routing', async ({ page }) => {
    await runUndoRedoCycle(page);
  });
});
