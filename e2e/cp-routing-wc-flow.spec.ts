import { expect, type Page, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  createTestFolder,
  dismissGuidedTour,
  moveToArchive,
  openNodeContextMenu,
  setupConsoleErrorTracking,
  waitForDraftUpdate,
  waitForSubTreeUpdate,
  waitForTreeTableLoad,
} from './utils/test-helpers';

test.describe
  .serial('CP routing + Working Copy build flow', () => {
    async function runBuildFlow(page: Page) {
      setupConsoleErrorTracking(page);

      await clearTestData(page);

      await page.goto(buildAppUrl('d/r'));
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);

      const timestamp = Date.now();
      const initialName = await createTestFolder(page, `CP Build ${timestamp}`);
      const nodeSelector = (name: string) => `[data-testid="tree-node"]:has-text("${name}")`;
      const createdNode = page.locator(nodeSelector(initialName)).first();

      await openNodeContextMenu(page, createdNode);
      await page.locator('[data-testid="context-menu-edit"]').click();
      const editDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('heading', { name: /Folderの編集|Edit Folder/ }) })
        .first();
      await expect(editDialog).toBeVisible();

      const renamedName = `${initialName} - updated`;
      const nameInput = editDialog
        .getByLabel(/Folder Name|名称|Name/)
        .or(editDialog.locator('[data-testid="folder-plugin-name-input"]'));
      await nameInput.fill(renamedName);
      const saveButton = editDialog
        .locator('[data-testid="edit-folder-plugin-confirm"]')
        .or(editDialog.getByRole('button', { name: /保存|Save|Update/ }));
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      await saveButton.click();
      await waitForDraftUpdate(page);
      await expect(page.locator(nodeSelector(renamedName))).toBeVisible({ timeout: 10000 });

      await moveToArchive(page, renamedName);
      await waitForSubTreeUpdate(page);
      await expect(page.locator(nodeSelector(renamedName))).not.toBeVisible({ timeout: 7000 });
    }

    test('end-to-end operations succeed with CommandProcessor routing enabled by default', async ({
      page,
    }) => {
      await runBuildFlow(page);
    });
  });
