import { expect, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  createTestFolder,
  dismissGuidedTour,
  openFolderCreateDialog,
  setupConsoleErrorTracking,
  waitForDraftUpdate,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

test.describe('Folder CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  test('フォルダ作成 - SpeedDialダイアログ経由で作成', async ({ page }) => {
    const folderName = await createTestFolder(page, 'Test Folder');

    await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('フォルダ作成ダイアログをキャンセルして作成が確定しない', async ({ page }) => {
    const initialFolderRows = await page.locator('[data-testid="console-table"] tr').count();

    await openFolderCreateDialog(page);

    const dialog = page
      .locator('dialog')
      .filter({
        has: page.getByRole('heading', { name: /Folderの作成|Folderの新規作成|Create Folder/ }),
      })
      .or(page.getByRole('dialog'));
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const uniqueName = `E2E-${Date.now()}`;
    const nameInput = dialog
      .getByLabel(/名称|Name/i)
      .or(dialog.locator('[data-testid="folder-plugin-name-input"]'));
    await nameInput.fill(uniqueName);
    const descriptionField = dialog
      .locator('textarea[name="description"]')
      .or(dialog.getByLabel(/説明|Description/i));
    if (await descriptionField.isVisible().catch(() => false)) {
      await descriptionField.fill('discard-on-cancel');
    }

    const cancelButton = dialog.getByRole('button', { name: /Cancel|キャンセル/ });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    const discardButton = page.getByRole('button', { name: 'Discard' });
    if (await discardButton.isVisible().catch(() => false)) {
      await expect(discardButton).toBeVisible({ timeout: 5000 });
      await discardButton.click();
    }
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    await waitForDraftUpdate(page);
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    const finalFolderRows = await page.locator('[data-testid="console-table"] tr').count();
    expect(finalFolderRows).toBe(initialFolderRows);

    const finalNodeRows = await page.locator('[data-testid="console-table"] tr').allTextContents();
    expect(finalNodeRows.join('\n')).not.toContain(uniqueName);
  });
});
