import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  createChildFolder,
  performDragDrop,
  waitForSubTreeUpdate,
  waitForWorkingCopyUpdate,
} from '../utils/test-helpers';

/**
 * Folder Drag & Drop E2E Tests
 *
 * Tests drag and drop functionality for folder operations including
 * moving folders, reordering, and hierarchy changes.
 * Based on the specification in docs/12-2-e2e-folder.md
 */

test.describe('Folder Drag & Drop Operations', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  test('フォルダの移動 - 同一階層での並び替え', async ({ page }) => {
    // テストフォルダを作成
    const folder1 = await createTestFolder(page, 'Folder A');
    const folder2 = await createTestFolder(page, 'Folder B');
    const folder3 = await createTestFolder(page, 'Folder C');

    // 初期順序を記録
    const nodes = page.locator('[data-testid="tree-node"]');
    const initialOrder = await nodes.evaluateAll((elements) =>
      elements.map((el) => el.textContent?.trim()).filter((text) => text?.includes('Folder'))
    );

    // Folder A を Folder C の後に移動
    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`);

    await performDragDrop(page, sourceNode, targetNode);
    await waitForSubTreeUpdate(page);

    // 順序が変更されたことを確認
    const finalOrder = await nodes.evaluateAll((elements) =>
      elements.map((el) => el.textContent?.trim()).filter((text) => text?.includes('Folder'))
    );

    expect(finalOrder).not.toEqual(initialOrder);
    // Folder A が最後に移動したことを確認
    expect(finalOrder[finalOrder.length - 1]).toContain(folder1);
  });

  test('フォルダの階層移動 - 子フォルダ化', async ({ page }) => {
    // 親と子になるフォルダを作成
    const parentFolder = await createTestFolder(page, 'Parent Folder');
    const childFolder = await createTestFolder(page, 'Child Folder');

    // 子フォルダを親フォルダにドラッグ
    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${childFolder}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);

    await performDragDrop(page, sourceNode, targetNode);
    await waitForSubTreeUpdate(page);

    // 親フォルダを展開
    await targetNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 子フォルダが親フォルダの下に移動したことを確認
    const parentId = await targetNode.getAttribute('data-node-id');
    const movedChild = page.locator(
      `[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childFolder}")`
    );
    await expect(movedChild).toBeVisible();

    // 元の場所に子フォルダがないことを確認
    const rootLevelChild = page.locator(
      `[data-testid="tree-node"][data-parent-id=""]:has-text("${childFolder}"), [data-testid="tree-node"]:not([data-parent-id]):has-text("${childFolder}")`
    );
    await expect(rootLevelChild).not.toBeVisible();
  });

  test('フォルダの階層移動 - 親階層への移動', async ({ page }) => {
    // 親フォルダと子フォルダを作成
    const parentFolder = await createTestFolder(page, 'Parent Folder');
    const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);

    // 子フォルダを作成
    const childFolder = await createChildFolder(page, parentNode, 'Child Folder');

    // 親フォルダを展開
    await parentNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 子フォルダを見つける
    const parentId = await parentNode.getAttribute('data-node-id');
    const childNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childFolder}")`
    );
    await expect(childNode).toBeVisible();

    // 子フォルダをルートレベルにドラッグ
    const rootArea = page.locator('[data-testid="tree-table-body"]');
    await performDragDrop(page, childNode, rootArea);
    await waitForSubTreeUpdate(page);

    // 子フォルダがルートレベルに移動したことを確認
    const rootLevelChild = page.locator(
      `[data-testid="tree-node"]:not([data-parent-id]):has-text("${childFolder}"), [data-testid="tree-node"][data-parent-id=""]:has-text("${childFolder}")`
    );
    await expect(rootLevelChild).toBeVisible();
  });

  test('ドラッグ中のビジュアルフィードバック', async ({ page }) => {
    // テストフォルダを作成
    const sourceFolder = await createTestFolder(page, 'Source Folder');
    const targetFolder = await createTestFolder(page, 'Target Folder');

    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

    // ドラッグを開始
    await sourceNode.hover();
    await page.mouse.down();

    // ドラッグ中のスタイル確認
    await expect(sourceNode).toHaveClass(/dragging/);

    // ターゲットにホバー
    await targetNode.hover();

    // ドロップゾーンのハイライト確認
    await expect(targetNode).toHaveClass(/drop-target/);

    // ドラッグを完了
    await page.mouse.up();

    // ドラッグ状態がクリアされることを確認
    await expect(sourceNode).not.toHaveClass(/dragging/);
    await expect(targetNode).not.toHaveClass(/drop-target/);
  });

  test('無効なドロップ操作の防止', async ({ page }) => {
    // 親フォルダと子フォルダを作成
    const parentFolder = await createTestFolder(page, 'Parent Folder');
    const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);

    const childFolder = await createChildFolder(page, parentNode, 'Child Folder');

    // 親フォルダを展開
    await parentNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    const parentId = await parentNode.getAttribute('data-node-id');
    const childNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childFolder}")`
    );

    // 親フォルダを子フォルダにドロップしようとする（循環参照の防止）
    await performDragDrop(page, parentNode, childNode);

    // エラーメッセージまたは無効操作の表示
    await expect(
      page.locator('[data-testid="invalid-drop-message"], [data-testid="circular-reference-error"]')
    ).toBeVisible({ timeout: 3000 });

    // 階層構造が変更されていないことを確認
    await expect(childNode).toHaveAttribute('data-parent-id', parentId);
  });

  test('複数選択でのドラッグ&ドロップ', async ({ page }) => {
    // 複数のフォルダを作成
    const folder1 = await createTestFolder(page, 'Multi Select 1');
    const folder2 = await createTestFolder(page, 'Multi Select 2');
    const folder3 = await createTestFolder(page, 'Multi Select 3');
    const targetFolder = await createTestFolder(page, 'Target Folder');

    // 複数フォルダを選択
    await page.keyboard.down('Control');
    await page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`).click();
    await page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`).click();
    await page.keyboard.up('Control');

    // 選択状態の確認
    await expect(page.locator('[data-testid="selected-count"]')).toHaveText('2 items selected');

    // 選択されたフォルダの一つをドラッグ
    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

    await performDragDrop(page, sourceNode, targetNode);
    await waitForSubTreeUpdate(page);

    // ターゲットフォルダを展開
    await targetNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 両方のフォルダが移動したことを確認
    const targetId = await targetNode.getAttribute('data-node-id');
    await expect(
      page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${folder1}")`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${folder2}")`)
    ).toBeVisible();
  });

  test('ドラッグ&ドロップによる詳細な位置指定', async ({ page }) => {
    // テストフォルダを作成
    const folder1 = await createTestFolder(page, 'Position A');
    const folder2 = await createTestFolder(page, 'Position B');
    const folder3 = await createTestFolder(page, 'Position C');

    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`);

    // 特定の位置（上部）にドロップ
    const targetBox = await targetNode.boundingBox();
    if (targetBox) {
      await sourceNode.hover();
      await page.mouse.down();

      // ターゲットの上部にドロップ
      await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + 5, // 上部
        { steps: 10 }
      );

      // ドロップ位置インジケーターの確認
      await expect(page.locator('[data-testid="drop-position-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="drop-position-indicator"]')).toHaveAttribute(
        'data-position',
        'before'
      );

      await page.mouse.up();
    }

    await waitForSubTreeUpdate(page);

    // フォルダ1がフォルダ2の前に配置されたことを確認
    const nodes = page.locator('[data-testid="tree-node"]');
    const order = await nodes.evaluateAll((elements) =>
      elements.map((el) => el.textContent?.trim()).filter((text) => text?.includes('Position'))
    );

    const indexA = order.findIndex((text) => text?.includes('Position A'));
    const indexB = order.findIndex((text) => text?.includes('Position B'));

    expect(indexA).toBeLessThan(indexB);
  });

  test('ドラッグ&ドロップの取り消し（Undo）', async ({ page }) => {
    // テストフォルダを作成
    const sourceFolder = await createTestFolder(page, 'Undo Source');
    const targetFolder = await createTestFolder(page, 'Undo Target');

    // 初期位置を記録
    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

    const initialParentId = (await sourceNode.getAttribute('data-parent-id')) || '';

    // ドラッグ&ドロップを実行
    await performDragDrop(page, sourceNode, targetNode);
    await waitForSubTreeUpdate(page);

    // 移動が完了したことを確認
    await targetNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    const targetId = await targetNode.getAttribute('data-node-id');
    const movedNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${sourceFolder}")`
    );
    await expect(movedNode).toBeVisible();

    // Undoを実行
    await page.keyboard.press('Control+z');
    await waitForSubTreeUpdate(page);

    // 元の位置に戻ったことを確認
    const restoredNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${initialParentId}"]:has-text("${sourceFolder}"), [data-testid="tree-node"]:not([data-parent-id]):has-text("${sourceFolder}")`
    );
    await expect(restoredNode).toBeVisible();
  });

  test('大量フォルダでのドラッグ&ドロップパフォーマンス', async ({ page }) => {
    // パフォーマンステスト用のデータを設定
    await page.evaluate(() => {
      localStorage.setItem('e2e-test-scenario', 'performance');
    });

    await page.reload();
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // 大量のフォルダがある環境での操作
    const sourceNode = page.locator('[data-testid="tree-node"]').first();
    const targetNode = page.locator('[data-testid="tree-node"]').nth(10);

    const startTime = Date.now();
    await performDragDrop(page, sourceNode, targetNode);
    await waitForSubTreeUpdate(page, 10000);
    const dragTime = Date.now() - startTime;

    // ドラッグ&ドロップが妥当な時間内に完了することを確認
    expect(dragTime).toBeLessThan(5000); // 5秒以内

    // UI の応答性確認
    await expect(sourceNode).toBeVisible();
    await expect(targetNode).toBeVisible();
  });

  test('タッチデバイスでのドラッグ&ドロップ', async ({ page }) => {
    // タッチデバイスをエミュレート
    await page.emulate(require('@playwright/test').devices['iPad']);

    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // テストフォルダを作成
    const sourceFolder = await createTestFolder(page, 'Touch Source');
    const targetFolder = await createTestFolder(page, 'Touch Target');

    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

    // タッチによるドラッグ&ドロップ
    const sourceBox = await sourceNode.boundingBox();
    const targetBox = await targetNode.boundingBox();

    if (sourceBox && targetBox) {
      // 長押しでドラッグ開始
      await page.touchscreen.tap(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2
      );

      // しばらく待ってからドラッグ状態を確認
      await page.waitForTimeout(1000);

      // タッチ移動
      await page.touchscreen.tap(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2
      );
    }

    await waitForSubTreeUpdate(page);

    // 移動が完了したことを確認
    await targetNode.locator('[data-testid="expand-button"]').tap();
    await waitForSubTreeUpdate(page);

    const targetId = await targetNode.getAttribute('data-node-id');
    const movedNode = page.locator(
      `[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${sourceFolder}")`
    );
    await expect(movedNode).toBeVisible();
  });

  test('ドラッグ&ドロップ中のエラーハンドリング', async ({ page }) => {
    // ネットワークエラーをシミュレート
    await page.route('**/api/folders/move', (route) => route.abort());

    // テストフォルダを作成
    const sourceFolder = await createTestFolder(page, 'Error Source');
    const targetFolder = await createTestFolder(page, 'Error Target');

    const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
    const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

    // ドラッグ&ドロップを実行
    await performDragDrop(page, sourceNode, targetNode);

    // エラーメッセージの表示確認
    await expect(page.locator('[data-testid="move-error-message"]')).toBeVisible();

    // リトライボタンの確認
    await expect(page.locator('[data-testid="retry-move-button"]')).toBeVisible();

    // 元の位置に戻っていることを確認
    await expect(sourceNode).toBeVisible();
    const originalParentId = (await sourceNode.getAttribute('data-parent-id')) || '';
    expect(originalParentId).toBe(''); // ルートレベル
  });
});
