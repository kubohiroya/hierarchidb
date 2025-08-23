import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  createChildFolder,
  moveToTrash,
  waitForSubTreeUpdate,
  waitForWorkingCopyUpdate,
} from '../utils/test-helpers';

/**
 * Folder CRUD Operations E2E Tests
 *
 * Tests folder creation, reading, updating, and deletion operations.
 * Based on the specification in docs/12-2-e2e-folder.md
 */

test.describe('Folder CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    // Navigate to specific tree with valid IDs to avoid routing issues
    // Using 'default' as treeId and 'defaultRoot' as pageTreeNodeId
    await page.goto('http://localhost:4202/hierarchidb/t/r');
    
    // If a dialog is open, close it
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      const closeButton = dialog.locator('button[aria-label="close"]').or(dialog.locator('text=Cancel'));
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }
    
    await dismissGuidedTour(page);
    // Wait for the page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('フォルダ作成 - SpeedDialから', async ({ page }) => {
    const folderName = await createTestFolder(page, 'Test Folder');

    // If createTestFolder completed without error, SpeedDial UI is working correctly
    expect(folderName).toBeTruthy();
    console.log('SpeedDial UI test passed - folder creation flow completed');
  });

  test('フォルダ作成 - コンテキストメニューから', async ({ page }) => {
    // ルートノードを右クリック
    const rootNode = page.locator('[data-testid="tree-node"]').first();
    await rootNode.click({ button: 'right' });

    // コンテキストメニューの確認
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    // Createサブメニューを開く
    await page.locator('[data-testid="context-menu-create"]').hover();
    await expect(page.locator('[data-testid="create-submenu"]')).toBeVisible();

    // フォルダ作成を選択
    await page.locator('[data-testid="create-submenu-folder"]').click();

    // 作成ダイアログの確認
    await expect(page.locator('[data-testid="folder-create-dialog"]')).toBeVisible();

    const folderName = `Context Menu Folder ${Date.now()}`;
    await page.locator('[data-testid="folder-name-input"]').fill(folderName);
    await page.locator('[data-testid="create-folder-confirm"]').click();

    // フォルダが作成されることを確認
    await expect(page.locator('[data-testid="folder-create-dialog"]')).not.toBeVisible();
    await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('子フォルダの作成', async ({ page }) => {
    // 親フォルダを作成
    const parentName = await createTestFolder(page, 'Parent Folder');
    const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentName}")`);

    // 子フォルダを作成
    const childName = await createChildFolder(page, parentNode, 'Child Folder');

    // 親フォルダを展開
    await parentNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 子フォルダが表示されることを確認
    const parentId = await parentNode.getAttribute('data-node-id');
    const childNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childName}")`
    );
    await expect(childNode).toBeVisible();
  });

  test('フォルダ名の編集', async ({ page }) => {
    // テストフォルダを作成
    const originalName = await createTestFolder(page, 'Original Name');
    const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`);

    // フォルダを右クリック
    await folderNode.click({ button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    // 編集を選択
    await page.locator('[data-testid="context-menu-edit"]').click();

    // 編集ダイアログの確認
    await expect(page.locator('[data-testid="folder-edit-dialog"]')).toBeVisible();

    // 新しい名前を入力
    const newName = `Edited Name ${Date.now()}`;
    const nameInput = page.locator('[data-testid="folder-name-input"]');
    await nameInput.clear();
    await nameInput.fill(newName);
    await page.locator('[data-testid="edit-folder-confirm"]').click();

    // 名前が変更されることを確認
    await expect(page.locator('[data-testid="folder-edit-dialog"]')).not.toBeVisible();
    await waitForWorkingCopyUpdate(page);
    await expect(page.locator(`[data-testid="tree-node"]:has-text("${newName}")`)).toBeVisible({
      timeout: 5000,
    });

    // 古い名前がないことを確認
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`)
    ).not.toBeVisible();
  });

  test('フォルダの削除（ゴミ箱移動）', async ({ page }) => {
    // テストフォルダを作成
    const folderName = await createTestFolder(page, 'Delete Test');

    // フォルダを削除
    await moveToTrash(page, folderName);

    // メインビューからフォルダが消えることを確認
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)
    ).not.toBeVisible();

    // ゴミ箱にフォルダが移動されることを確認
    await page.locator('[data-testid="trash-button"]').click();
    await expect(page.locator('[data-testid="trash-panel"]')).toBeVisible();
    await expect(
      page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`)
    ).toBeVisible();
  });

  test('ゴミ箱からの復元', async ({ page }) => {
    // テストフォルダを作成して削除
    const folderName = await createTestFolder(page, 'Restore Test');
    await moveToTrash(page, folderName);

    // ゴミ箱を開く
    await page.locator('[data-testid="trash-button"]').click();
    await expect(page.locator('[data-testid="trash-panel"]')).toBeVisible();

    // フォルダを右クリック
    const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
    await trashItem.click({ button: 'right' });

    // 復元を選択
    await expect(page.locator('[data-testid="trash-context-menu"]')).toBeVisible();
    await page.locator('[data-testid="trash-menu-restore"]').click();

    // 復元確認
    await expect(page.locator('[data-testid="restore-confirmation-dialog"]')).toBeVisible();
    await page.locator('[data-testid="confirm-restore"]').click();

    // ゴミ箱を閉じる
    await page.locator('[data-testid="close-trash-panel"]').click();

    // メインビューに復元されることを確認
    await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).toBeVisible({
      timeout: 5000,
    });
  });

  test('ゴミ箱からの完全削除', async ({ page }) => {
    // テストフォルダを作成して削除
    const folderName = await createTestFolder(page, 'Permanent Delete Test');
    await moveToTrash(page, folderName);

    // ゴミ箱を開く
    await page.locator('[data-testid="trash-button"]').click();
    await expect(page.locator('[data-testid="trash-panel"]')).toBeVisible();

    // フォルダを右クリック
    const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
    await trashItem.click({ button: 'right' });

    // 完全削除を選択
    await expect(page.locator('[data-testid="trash-context-menu"]')).toBeVisible();
    await page.locator('[data-testid="trash-menu-delete-permanent"]').click();

    // 削除確認
    await expect(
      page.locator('[data-testid="permanent-delete-confirmation-dialog"]')
    ).toBeVisible();
    await page.locator('[data-testid="confirm-permanent-delete"]').click();

    // ゴミ箱からも削除されることを確認
    await expect(
      page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`)
    ).not.toBeVisible({ timeout: 5000 });
  });

  test('フォルダ作成時のバリデーション', async ({ page }) => {
    // SpeedDialからフォルダ作成を開始
    await page.locator('[data-testid="speed-dial-fab"]').click();
    await page.locator('[data-testid="create-folder-action"]').click();

    // 空の名前で作成を試行
    await expect(page.locator('[data-testid="folder-create-dialog"]')).toBeVisible();
    await page.locator('[data-testid="create-folder-confirm"]').click();

    // エラーメッセージの確認
    await expect(page.locator('[data-testid="name-validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="name-validation-error"]')).toHaveText(
      /Name is required|名前は必須です/
    );

    // 無効な文字を含む名前
    await page.locator('[data-testid="folder-name-input"]').fill('Invalid/Name');
    await page.locator('[data-testid="create-folder-confirm"]').click();

    // 無効文字エラーの確認
    await expect(page.locator('[data-testid="name-validation-error"]')).toHaveText(
      /Invalid characters|無効な文字が含まれています/
    );

    // ダイアログをキャンセル
    await page.locator('[data-testid="cancel-folder-create"]').click();
    await expect(page.locator('[data-testid="folder-create-dialog"]')).not.toBeVisible();
  });

  test('重複名のハンドリング', async ({ page }) => {
    // 最初のフォルダを作成
    const originalName = 'Duplicate Test';
    await createTestFolder(page, originalName);

    // 同じ名前でもう一つ作成を試行
    await page.locator('[data-testid="speed-dial-fab"]').click();
    await page.locator('[data-testid="create-folder-action"]').click();

    await page.locator('[data-testid="folder-name-input"]').fill(originalName);
    await page.locator('[data-testid="create-folder-confirm"]').click();

    // 重複名処理の確認（自動的に番号が付与される）
    await expect(page.locator('[data-testid="folder-create-dialog"]')).not.toBeVisible();

    // 元のフォルダと新しいフォルダの両方が存在することを確認
    const allFolders = page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`);
    await expect(allFolders).toHaveCount.atLeast(2);
  });

  test('フォルダのプロパティ表示', async ({ page }) => {
    // テストフォルダを作成
    const folderName = await createTestFolder(page, 'Properties Test');
    const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);

    // フォルダを右クリック
    await folderNode.click({ button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    // プロパティを選択
    await page.locator('[data-testid="context-menu-properties"]').click();

    // プロパティダイアログの確認
    await expect(page.locator('[data-testid="folder-properties-dialog"]')).toBeVisible();

    // 基本情報の確認
    await expect(page.locator('[data-testid="property-name"]')).toHaveText(folderName);
    await expect(page.locator('[data-testid="property-type"]')).toHaveText(/Folder|フォルダ/);
    await expect(page.locator('[data-testid="property-created"]')).toBeVisible();
    await expect(page.locator('[data-testid="property-modified"]')).toBeVisible();

    // ダイアログを閉じる
    await page.locator('[data-testid="close-properties"]').click();
    await expect(page.locator('[data-testid="folder-properties-dialog"]')).not.toBeVisible();
  });

  test('フォルダの複製', async ({ page }) => {
    // テストフォルダを作成
    const originalName = await createTestFolder(page, 'Duplicate Source');
    const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`);

    // フォルダを右クリック
    await folderNode.click({ button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    // 複製を選択
    await page.locator('[data-testid="context-menu-duplicate"]').click();

    // 複製されたフォルダが表示されることを確認
    await waitForSubTreeUpdate(page);
    const duplicatePattern = new RegExp(`${originalName}.*Copy|${originalName}.*複製`);
    await expect(
      page.locator(`[data-testid="tree-node"]`).filter({ hasText: duplicatePattern })
    ).toBeVisible({ timeout: 5000 });
  });

  test('一括選択によるフォルダ削除', async ({ page }) => {
    // 複数のテストフォルダを作成
    const folder1 = await createTestFolder(page, 'Batch Delete 1');
    const folder2 = await createTestFolder(page, 'Batch Delete 2');
    const folder3 = await createTestFolder(page, 'Batch Delete 3');

    // Ctrlキーを押しながら複数選択
    await page.keyboard.down('Control');
    await page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`).click();
    await page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`).click();
    await page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`).click();
    await page.keyboard.up('Control');

    // 選択数の確認
    await expect(page.locator('[data-testid="selected-count"]')).toHaveText('3 items selected');

    // 右クリックでコンテキストメニューを開く
    await page
      .locator(`[data-testid="tree-node"]:has-text("${folder1}")`)
      .click({ button: 'right' });
    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

    // 一括削除を実行
    await page.locator('[data-testid="context-menu-remove"]').click();
    await expect(page.locator('[data-testid="batch-trash-confirmation-dialog"]')).toBeVisible();
    await page.locator('[data-testid="confirm-batch-trash"]').click();

    // すべてのフォルダが削除されることを確認
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`)
    ).not.toBeVisible();
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`)
    ).not.toBeVisible();
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`)
    ).not.toBeVisible();
  });

  test('フォルダ作成の取り消し（Undo）', async ({ page }) => {
    // 初期状態のフォルダ数を記録
    const initialFolders = await page
      .locator('[data-testid="tree-node"][data-node-type="folder"]')
      .count();

    // フォルダを作成
    const folderName = await createTestFolder(page, 'Undo Test');

    // フォルダが作成されたことを確認
    await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).toBeVisible();

    // Undoを実行
    await page.keyboard.press('Control+z');
    await waitForSubTreeUpdate(page);

    // フォルダが削除されることを確認
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)
    ).not.toBeVisible();

    // フォルダ数が元に戻ることを確認
    const finalFolders = await page
      .locator('[data-testid="tree-node"][data-node-type="folder"]')
      .count();
    expect(finalFolders).toBe(initialFolders);
  });

  test('フォルダ削除の取り消し（Redo）', async ({ page }) => {
    // フォルダを作成
    const folderName = await createTestFolder(page, 'Redo Test');

    // Undoでフォルダを削除
    await page.keyboard.press('Control+z');
    await waitForSubTreeUpdate(page);
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)
    ).not.toBeVisible();

    // Redoでフォルダを復元
    await page.keyboard.press('Control+y');
    await waitForSubTreeUpdate(page);

    // フォルダが復元されることを確認
    await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)).toBeVisible({
      timeout: 5000,
    });
  });
});
