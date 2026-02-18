import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  moveToArchive,
  waitForSubTreeUpdate,
  waitForDraftUpdate,
  performDragDrop,
  buildAppUrl,
} from './utils/test-helpers';

test.describe.serial('CP routing + Working Copy batch flow', () => {
  async function runBatchFlow(page: Parameters<typeof test>[0]['page']) {
    setupConsoleErrorTracking(page);

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
    await waitForDraftUpdate(page);
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

    await moveToArchive(page, renamedName);
    await waitForSubTreeUpdate(page);
    await expect(page.locator(nodeSelector(renamedName))).not.toBeVisible({ timeout: 7000 });

    await page.locator('[data-testid="archive-button"]').click();
    const archiveItem = page.locator(`[data-testid="archive-item"]:has-text("${renamedName}")`).first();
    await expect(archiveItem).toBeVisible({ timeout: 7000 });

    await archiveItem.click({ button: 'right' });
    await expect(page.locator('[data-testid="archive-context-menu"]')).toBeVisible();
    await page.locator('[data-testid="archive-menu-restore"]').click();
    await expect(page.locator('[data-testid="restore-confirmation-base-dialog"]')).toBeVisible({ timeout: 5000 });
    await page.locator('[data-testid="confirm-restore"]').click();
    await waitForSubTreeUpdate(page);
    await expect(archiveItem).not.toBeVisible({ timeout: 7000 });
    await page.locator('[data-testid="close-archive-panel"]').click();

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

    await waitForDraftUpdate(page);
  }

  test('end-to-end operations succeed with CommandProcessor routing enabled by default', async ({ page }) => {
    await runBatchFlow(page);
  });
});
