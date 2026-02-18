import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  renameFolder,
  moveToArchive,
  restoreFromArchive,
  waitForDraftUpdate,
  clickUndo,
  clickRedo,
  buildAppUrl,
} from '../utils/test-helpers';

/**
 * Folder Undo/Redo E2E Test
 *
 * Validates that the undo/redo stack captures create, rename, archive, and restore
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

    await moveToArchive(page, renamedName);
    await waitForDraftUpdate(page);
    await restoreFromArchive(page, renamedName);

    const treeNode = (name: string) =>
      page.locator('[data-testid="console-node"]').filter({ hasText: name }).first();
    const archiveItem = (name: string) =>
      page.locator('[data-testid="archive-item"]').filter({ hasText: name }).first();

    const expectInArchive = async (name: string) => {
      await page.locator('[data-testid="archive-button"]').click();
      const archivePanel = page.locator('[data-testid="archive-panel"]');
      await expect(archivePanel).toBeVisible({ timeout: 5000 });
      await expect(archiveItem(name)).toBeVisible({ timeout: 5000 });
      await page.locator('[data-testid="close-archive-panel"]').click();
      await expect(archivePanel).not.toBeVisible({ timeout: 5000 });
    };

    const expectNotInArchive = async (name: string) => {
      await page.locator('[data-testid="archive-button"]').click();
      const archivePanel = page.locator('[data-testid="archive-panel"]');
      await expect(archivePanel).toBeVisible({ timeout: 5000 });
      await expect(archiveItem(name)).toHaveCount(0);
      await page.locator('[data-testid="close-archive-panel"]').click();
      await expect(archivePanel).not.toBeVisible({ timeout: 5000 });
    };

    // Baseline: node restored to main console and absent from archive
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInArchive(renamedName);

    // Undo restore → node back into archive
    await clickUndo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInArchive(renamedName);

    // Undo remove → node returns to console with renamed atoms
    await clickUndo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInArchive(renamedName);

    // Undo rename → original name restored
    await clickUndo(page);
    await expect(treeNode(originalName)).toBeVisible({ timeout: 5000 });
    await expect(treeNode(renamedName)).toHaveCount(0);

    // Undo create → node fully removed
    await clickUndo(page);
    await expect(treeNode(originalName)).toHaveCount(0);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectNotInArchive(renamedName);

    // Redo create → original node returns
    await clickRedo(page);
    await expect(treeNode(originalName)).toBeVisible({ timeout: 5000 });

    // Redo rename → node reflects renamed atoms
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expect(treeNode(originalName)).toHaveCount(0);

    // Redo remove → node moves to archive
    await clickRedo(page);
    await expect(treeNode(renamedName)).toHaveCount(0);
    await expectInArchive(renamedName);

    // Redo restore → node back to console, archive cleared
    await clickRedo(page);
    await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });
    await expectNotInArchive(renamedName);
  }

  test('create → rename → archive → restore supports undo/redo cycle with CommandProcessor routing', async ({ page }) => {
    await runUndoRedoCycle(page);
  });
});
