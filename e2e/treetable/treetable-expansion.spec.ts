import { test, expect } from '@playwright/test';
import {
  dismissGuidedTour,
  waitForTreeTableLoad,
  setupConsoleErrorTracking,
  clearTestData,
  waitForSubTreeUpdate,
} from '../utils/test-helpers';

/**
 * TreeTable Expansion E2E Tests
 *
 * Tests the node expansion and collapse functionality of the TreeTable component.
 * Based on the specification in docs/12-1-e2e-treetable.md
 */

test.describe('TreeTable Expansion', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  test('個別ノードの展開・折りたたみ', async ({ page }) => {
    // 展開可能なノードを特定
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expect(expandableNode).toBeVisible();

    // 初期状態で折りたたまれていることを確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );

    // 展開ボタンをクリック
    await expandableNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 展開状態の確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    // 子ノードが表示されることを確認
    const parentId = await expandableNode.getAttribute('data-node-id');
    const childNodes = page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]`);
    await expect(childNodes).toHaveCount.atLeast(1);

    // 再度クリックして折りたたみ
    await expandableNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 折りたたまれた状態の確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );

    // 子ノードが非表示になることを確認
    await expect(childNodes).toHaveCount(0);
  });

  test('キーボードによる展開・折りたたみ', async ({ page }) => {
    // 展開可能なノードにフォーカス
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expandableNode.focus();

    // 右矢印キーで展開
    await page.keyboard.press('ArrowRight');
    await waitForSubTreeUpdate(page);

    // 展開状態の確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    // 左矢印キーで折りたたみ
    await page.keyboard.press('ArrowLeft');
    await waitForSubTreeUpdate(page);

    // 折りたたまれた状態の確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );
  });

  test('全展開・全折りたたみ', async ({ page }) => {
    // 展開可能なノードの数を取得
    const expandableNodes = page.locator('[data-testid="tree-node"][data-has-children="true"]');
    const nodeCount = await expandableNodes.count();

    if (nodeCount === 0) {
      test.skip('展開可能なノードがありません');
    }

    // 全展開ボタンをクリック
    await page.locator('[data-testid="expand-all-button"]').click();
    await waitForSubTreeUpdate(page, 5000); // 全展開は時間がかかる場合がある

    // すべての展開可能ノードが展開されていることを確認
    for (let i = 0; i < nodeCount; i++) {
      await expect(expandableNodes.nth(i).locator('[data-testid="expand-icon"]')).toHaveAttribute(
        'data-expanded',
        'true'
      );
    }

    // 全折りたたみボタンをクリック
    await page.locator('[data-testid="collapse-all-button"]').click();
    await waitForSubTreeUpdate(page, 5000);

    // すべての展開可能ノードが折りたたまれていることを確認
    for (let i = 0; i < nodeCount; i++) {
      await expect(expandableNodes.nth(i).locator('[data-testid="expand-icon"]')).toHaveAttribute(
        'data-expanded',
        'false'
      );
    }
  });

  test('ネストされた階層の展開', async ({ page }) => {
    // 最上位ノードを展開
    const topLevelNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await topLevelNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    const topLevelId = await topLevelNode.getAttribute('data-node-id');

    // 子ノードで展開可能なものを探す
    const childExpandableNode = page
      .locator(
        `[data-testid="tree-node"][data-parent-id="${topLevelId}"][data-has-children="true"]`
      )
      .first();

    if ((await childExpandableNode.count()) > 0) {
      // 子ノードを展開
      await childExpandableNode.locator('[data-testid="expand-button"]').click();
      await waitForSubTreeUpdate(page);

      // 孫ノードが表示されることを確認
      const childId = await childExpandableNode.getAttribute('data-node-id');
      const grandChildNodes = page.locator(
        `[data-testid="tree-node"][data-parent-id="${childId}"]`
      );
      await expect(grandChildNodes).toHaveCount.atLeast(1);

      // 階層インデントの確認
      const indentLevel = await grandChildNodes.first().evaluate((el) => {
        const style = getComputedStyle(el);
        return style.paddingLeft || style.marginLeft;
      });

      expect(indentLevel).toBeTruthy(); // インデントが適用されている
    }
  });

  test('展開状態の永続化', async ({ page }) => {
    // ノードを展開
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    const nodeId = await expandableNode.getAttribute('data-node-id');

    await expandableNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // ページリロード
    await page.reload();
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // 展開状態が維持されていることを確認
    const reloadedNode = page.locator(`[data-testid="tree-node"][data-node-id="${nodeId}"]`);
    await expect(reloadedNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    // 子ノードも表示されていることを確認
    const childNodes = page.locator(`[data-testid="tree-node"][data-parent-id="${nodeId}"]`);
    await expect(childNodes).toHaveCount.atLeast(1);
  });

  test('展開中のローディング状態', async ({ page }) => {
    // API レスポンスを遅延させる
    await page.route('**/api/subtree/**', async (route) => {
      await page.waitForTimeout(1000);
      await route.continue();
    });

    // ノードを展開
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expandableNode.locator('[data-testid="expand-button"]').click();

    // ローディングインジケーターの確認
    await expect(expandableNode.locator('[data-testid="expand-loading"]')).toBeVisible();

    // ローディング完了後の確認
    await waitForSubTreeUpdate(page, 3000);
    await expect(expandableNode.locator('[data-testid="expand-loading"]')).not.toBeVisible();
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('大量ノードでの展開パフォーマンス', async ({ page }) => {
    // パフォーマンステスト用のデータを設定
    await page.evaluate(() => {
      localStorage.setItem('e2e-test-scenario', 'performance');
    });

    await page.reload();
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // 大量ノードを持つフォルダを展開
    const largeNode = page.locator('[data-testid="tree-node"][data-has-children="true"]').first();

    const startTime = Date.now();
    await largeNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page, 10000);
    const expandTime = Date.now() - startTime;

    // 展開時間が妥当な範囲内であることを確認
    expect(expandTime).toBeLessThan(3000); // 3秒以内

    // UI の応答性確認
    await expect(largeNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('展開エラーのハンドリング', async ({ page }) => {
    // SubTree API エラーをシミュレート
    await page.route('**/api/subtree/**', (route) => route.abort());

    // ノード展開を試行
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expandableNode.locator('[data-testid="expand-button"]').click();

    // エラー状態の確認
    await expect(page.locator('[data-testid="expand-error"]')).toBeVisible();

    // リトライボタンの確認
    await expect(page.locator('[data-testid="expand-retry"]')).toBeVisible();

    // ノードが展開されていないことを確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'false'
    );
  });

  test('展開アニメーションの確認', async ({ page }) => {
    // アニメーションを有効にする
    await page.evaluate(() => {
      localStorage.removeItem('disable-animations');
    });

    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();

    // 展開開始
    await expandableNode.locator('[data-testid="expand-button"]').click();

    // アニメーション中の状態確認
    await expect(expandableNode).toHaveClass(/expanding/);

    // アニメーション完了まで待機
    await waitForSubTreeUpdate(page);
    await page.waitForTimeout(500); // アニメーション完了待ち

    // 最終状態の確認
    await expect(expandableNode).not.toHaveClass(/expanding/);
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('タッチデバイスでの展開操作', async ({ page }) => {
    // タッチデバイスをエミュレート
    await page.emulate(require('@playwright/test').devices['iPad']);

    await page.goto('/treeconsole-simple');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // タッチによる展開
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expandableNode.locator('[data-testid="expand-button"]').tap();
    await waitForSubTreeUpdate(page);

    // 展開状態の確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });

  test('展開状態とフィルタリングの組み合わせ', async ({ page }) => {
    // ノードを展開
    const expandableNode = page
      .locator('[data-testid="tree-node"][data-has-children="true"]')
      .first();
    await expandableNode.locator('[data-testid="expand-button"]').click();
    await waitForSubTreeUpdate(page);

    // 検索フィルターを適用
    await page.locator('[data-testid="search-input"]').fill('test');
    await page.waitForTimeout(500); // デバウンス待ち

    // フィルター適用後も展開状態が維持されることを確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );

    // フィルターをクリア
    await page.locator('[data-testid="search-clear"]').click();
    await page.waitForTimeout(500);

    // 展開状態が復元されることを確認
    await expect(expandableNode.locator('[data-testid="expand-icon"]')).toHaveAttribute(
      'data-expanded',
      'true'
    );
  });
});
