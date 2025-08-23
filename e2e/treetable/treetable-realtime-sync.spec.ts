import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  createTestFolder,
  waitForSubTreeUpdate,
  waitForWorkingCopyUpdate,
} from '../utils/test-helpers';

/**
 * TreeTable Real-time Synchronization E2E Tests
 *
 * Tests the SubTree subscription system and real-time updates.
 * Based on the specification in docs/12-1-e2e-treetable.md
 */

test.describe('TreeTable Real-time Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  test('SubTree購読の開始と停止', async ({ page }) => {
    // SubTree購読インジケーターの確認
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'active'
    );

    // 購読停止
    await page.locator('[data-testid="pause-subscription-button"]').click();
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'paused'
    );

    // 購読再開
    await page.locator('[data-testid="resume-subscription-button"]').click();
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'active'
    );
  });

  test('リアルタイムでのノード追加検出', async ({ page }) => {
    // 別のタブ/ウィンドウでの変更をシミュレート
    await page.evaluate(async () => {
      // Worker経由でノード追加をシミュレート
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.createFolder({
          name: 'Real-time Test Folder',
          parentId: null,
        });
      }
    });

    // リアルタイム更新を待機
    await waitForSubTreeUpdate(page);

    // 新しいフォルダが表示されることを確認
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Real-time Test Folder")')
    ).toBeVisible({ timeout: 5000 });

    // 更新通知の表示確認
    await expect(page.locator('[data-testid="realtime-update-notification"]')).toBeVisible();
  });

  test('リアルタイムでのノード更新検出', async ({ page }) => {
    // テストフォルダを作成
    const folderName = await createTestFolder(page, 'Update Test Folder');
    const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
    const nodeId = await folderNode.getAttribute('data-node-id');

    // 別セッションでの更新をシミュレート
    await page.evaluate(async (id) => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.updateFolder({
          id: id,
          name: 'Updated Folder Name',
        });
      }
    }, nodeId);

    // リアルタイム更新を待機
    await waitForSubTreeUpdate(page);

    // 更新されたフォルダ名が表示されることを確認
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Updated Folder Name")')
    ).toBeVisible({ timeout: 5000 });

    // 古い名前がないことを確認
    await expect(
      page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`)
    ).not.toBeVisible();
  });

  test('リアルタイムでのノード削除検出', async ({ page }) => {
    // テストフォルダを作成
    const folderName = await createTestFolder(page, 'Delete Test Folder');
    const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
    const nodeId = await folderNode.getAttribute('data-node-id');

    // フォルダが表示されていることを確認
    await expect(folderNode).toBeVisible();

    // 別セッションでの削除をシミュレート
    await page.evaluate(async (id) => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.deleteFolder({ id: id });
      }
    }, nodeId);

    // リアルタイム更新を待機
    await waitForSubTreeUpdate(page);

    // フォルダが削除されることを確認
    await expect(folderNode).not.toBeVisible({ timeout: 5000 });

    // 削除通知の表示確認
    await expect(page.locator('[data-testid="node-deleted-notification"]')).toBeVisible();
  });

  test('複数ノードの同時更新処理', async ({ page }) => {
    // 複数のテストフォルダを作成
    const folder1 = await createTestFolder(page, 'Batch Update 1');
    const folder2 = await createTestFolder(page, 'Batch Update 2');
    const folder3 = await createTestFolder(page, 'Batch Update 3');

    // 複数ノードの同時更新をシミュレート
    await page.evaluate(async () => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        // バッチ更新を実行
        await Promise.all([
          worker.updateFolder({ id: 'node1', name: 'Batch Updated 1' }),
          worker.updateFolder({ id: 'node2', name: 'Batch Updated 2' }),
          worker.updateFolder({ id: 'node3', name: 'Batch Updated 3' }),
        ]);
      }
    });

    // バッチ更新の完了を待機
    await waitForSubTreeUpdate(page, 5000);

    // すべての更新が反映されることを確認
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Batch Updated 1")')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Batch Updated 2")')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Batch Updated 3")')
    ).toBeVisible();

    // バッチ更新インジケーターの確認
    await expect(page.locator('[data-testid="batch-update-indicator"]')).toHaveText(
      /3 items updated/
    );
  });

  test('ネットワーク切断時の再接続処理', async ({ page }) => {
    // ネットワーク切断をシミュレート
    await page.setOffline(true);

    // オフライン状態の表示確認
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible({ timeout: 5000 });

    // SubTree購読のステータス確認
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'disconnected'
    );

    // ネットワーク復旧
    await page.setOffline(false);

    // 再接続処理の確認
    await expect(page.locator('[data-testid="reconnecting-indicator"]')).toBeVisible({
      timeout: 3000,
    });

    // 接続復旧の確認
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'active',
      { timeout: 10000 }
    );

    // オフライン中に蓄積された変更の同期確認
    await waitForSubTreeUpdate(page);
    await expect(page.locator('[data-testid="sync-completed-notification"]')).toBeVisible();
  });

  test('Working Copy状態でのリアルタイム同期制御', async ({ page }) => {
    // Working Copyを開始
    await page.locator('[data-testid="start-working-copy"]').click();
    await waitForWorkingCopyUpdate(page);

    // Working Copy状態での購読ステータス確認
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'working-copy-mode'
    );

    // 外部変更をシミュレート
    await page.evaluate(async () => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.createFolder({
          name: 'External Change During Working Copy',
          parentId: null,
        });
      }
    });

    // Working Copy中は外部変更が即座に反映されないことを確認
    await page.waitForTimeout(2000);
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("External Change During Working Copy")')
    ).not.toBeVisible();

    // 保留中の変更通知の確認
    await expect(page.locator('[data-testid="pending-changes-indicator"]')).toBeVisible();

    // Working Copyをコミット
    await page.locator('[data-testid="commit-working-copy"]').click();
    await waitForWorkingCopyUpdate(page);

    // コミット後に外部変更が反映されることを確認
    await waitForSubTreeUpdate(page);
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("External Change During Working Copy")')
    ).toBeVisible({ timeout: 5000 });
  });

  test('購読フィルタリングの動作確認', async ({ page }) => {
    // 特定のフォルダにフィルターを設定
    const parentFolder = await createTestFolder(page, 'Filtered Parent');
    const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);
    const parentId = await parentNode.getAttribute('data-node-id');

    // フィルター設定
    await page.locator('[data-testid="subscription-filter-button"]').click();
    await expect(page.locator('[data-testid="filter-dialog"]')).toBeVisible();

    await page.locator('[data-testid="filter-parent-input"]').fill(parentId || '');
    await page.locator('[data-testid="apply-filter"]').click();

    // フィルター範囲外での変更をシミュレート
    await page.evaluate(async () => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.createFolder({
          name: 'Outside Filter Range',
          parentId: null, // ルートレベル
        });
      }
    });

    // フィルター範囲外の変更は通知されないことを確認
    await page.waitForTimeout(2000);
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Outside Filter Range")')
    ).not.toBeVisible();

    // フィルター範囲内での変更をシミュレート
    await page.evaluate(async (id) => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.createFolder({
          name: 'Inside Filter Range',
          parentId: id,
        });
      }
    }, parentId);

    // フィルター範囲内の変更は通知されることを確認
    await waitForSubTreeUpdate(page);

    // 親フォルダを展開
    await parentNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    await expect(
      page.locator(
        `[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("Inside Filter Range")`
      )
    ).toBeVisible();
  });

  test('高頻度更新時のパフォーマンス制御', async ({ page }) => {
    // 高頻度更新をシミュレート
    await page.evaluate(async () => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        // 短時間での大量更新
        for (let i = 0; i < 50; i++) {
          await worker.createFolder({
            name: `High Frequency ${i}`,
            parentId: null,
          });
        }
      }
    });

    // スロットリングインジケーターの確認
    await expect(page.locator('[data-testid="update-throttling-indicator"]')).toBeVisible();

    // 最終的にすべての更新が反映されることを確認
    await waitForSubTreeUpdate(page, 10000);

    const highFrequencyNodes = page.locator('[data-testid="tree-node"]:has-text("High Frequency")');
    await expect(highFrequencyNodes).toHaveCount.atLeast(45); // スロットリングで一部が結合される可能性
  });

  test('購読エラー時の復旧処理', async ({ page }) => {
    // SubTree APIエラーをシミュレート
    await page.route('**/api/subtree/subscribe', (route) => route.abort());

    // 購読エラーの検出
    await page.reload();
    await dismissGuidedTour(page);

    // エラー状態の確認
    await expect(page.locator('[data-testid="subscription-error-indicator"]')).toBeVisible({
      timeout: 5000,
    });

    // 手動再接続
    await expect(page.locator('[data-testid="reconnect-subscription-button"]')).toBeVisible();

    // APIエラーを解除
    await page.unroute('**/api/subtree/subscribe');

    // 再接続を実行
    await page.locator('[data-testid="reconnect-subscription-button"]').click();

    // 接続復旧の確認
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'active',
      { timeout: 10000 }
    );
  });

  test('メモリリーク防止のための購読クリーンアップ', async ({ page }) => {
    // 初期メモリ使用量
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // 複数のページ遷移をシミュレート
    for (let i = 0; i < 5; i++) {
      await page.goto('/treeconsole-simple');
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);

      // SubTree購読が適切に開始されることを確認
      await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
        'data-status',
        'active'
      );

      // 別のページに移動
      await page.goto('/about');
      await page.waitForTimeout(1000);
    }

    // 最終メモリ使用量
    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // メモリ使用量の異常な増加がないことを確認
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const increaseRatio = memoryIncrease / initialMemory;
      expect(increaseRatio).toBeLessThan(3.0); // 3倍以下の増加
    }
  });

  test('購読の一時停止と再開による状態同期', async ({ page }) => {
    // 購読を一時停止
    await page.locator('[data-testid="pause-subscription-button"]').click();
    await expect(page.locator('[data-testid="subtree-subscription-status"]')).toHaveAttribute(
      'data-status',
      'paused'
    );

    // 停止中に外部変更をシミュレート
    await page.evaluate(async () => {
      const worker = (window as any).__hierarchidb_worker__;
      if (worker) {
        await worker.createFolder({
          name: 'Created While Paused',
          parentId: null,
        });
        await worker.createFolder({
          name: 'Another While Paused',
          parentId: null,
        });
      }
    });

    // 停止中は変更が反映されないことを確認
    await page.waitForTimeout(2000);
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Created While Paused")')
    ).not.toBeVisible();

    // 購読を再開
    await page.locator('[data-testid="resume-subscription-button"]').click();

    // 再開時の同期処理の確認
    await expect(page.locator('[data-testid="sync-in-progress-indicator"]')).toBeVisible();

    // 停止中の変更がすべて反映されることを確認
    await waitForSubTreeUpdate(page, 10000);
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Created While Paused")')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tree-node"]:has-text("Another While Paused")')
    ).toBeVisible();

    // 同期完了の確認
    await expect(page.locator('[data-testid="sync-completed-notification"]')).toBeVisible();
  });
});
