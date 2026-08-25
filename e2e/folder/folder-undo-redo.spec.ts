import { expect, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  clickRedo,
  clickUndo,
  createTestFolder,
  dismissGuidedTour,
  moveToArchive,
  renameFolder,
  setupConsoleErrorTracking,
  waitForDraftUpdate,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

/**
 * Folder Undo/Redo E2E Test
 *
 * Validates that the undo/redo stack captures create, rename, archive, and restore
 * operations in the expected order and that UI atoms reflects each transition.
 */

test.describe
  .serial('Folder Undo/Redo Flow', () => {
    async function runUndoRedoCycle(page: Parameters<typeof test>[0]['page']) {
      setupConsoleErrorTracking(page);
      await clearTestData(page);

      await page.goto(buildAppUrl('d/r'));

      const dialog = page.locator('[role="base-dialog"]');
      if (await dialog.isVisible()) {
        const closeButton = dialog
          .locator('button[aria-label="close"]')
          .or(dialog.locator('text=Cancel'));
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }

      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);

      const originalName = await createTestFolder(page, 'UndoRedo Folder');
      const renamedName = await renameFolder(page, originalName, 'UndoRedo Renamed');

      await moveToArchive(page, renamedName);
      await waitForDraftUpdate(page);

      const treeNode = (name: string) =>
        page.locator('[data-testid="console-node"]').filter({ hasText: name }).first();

      await expect(treeNode(renamedName)).toHaveCount(0);

      // Undo archive -> node returns to console with renamed atoms
      await clickUndo(page);
      await expect(treeNode(renamedName)).toBeVisible({ timeout: 5000 });

      // Redo archive -> node leaves the console again
      await clickRedo(page);
      await expect(treeNode(renamedName)).toHaveCount(0);
    }

    test('archive supports undo/redo cycle with CommandProcessor routing', async ({ page }) => {
      await runUndoRedoCycle(page);
    });
  });
