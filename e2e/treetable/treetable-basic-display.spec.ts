import { expect, type Page, test } from '@playwright/test';
import {
  buildAppUrl,
  clearTestData,
  dismissGuidedTour,
  setupConsoleErrorTracking,
  waitForTreeTableLoad,
} from '../utils/test-helpers';

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize?: number;
  };
};

const treeTableContainer = (page: Page) => page.locator('[data-tour-id="tree-table"]').first();

const treeTable = (page: Page) => treeTableContainer(page).locator('table').first();

/**
 * TreeTable Basic Display E2E Tests
 *
 * Tests the fundamental display and rendering functionality of the TreeTable component.
 * Based on the specification in docs/12-1-e2e-treetable.md
 */

test.describe('TreeTable Basic Display', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleErrorTracking(page);
    await clearTestData(page);
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
  });

  test('初期表示とレンダリング', async ({ page }) => {
    // TreeTable コンポーネントの表示確認
    await expect(treeTableContainer(page)).toBeVisible();

    // ヘッダー行の確認
    await expect(treeTable(page).locator('thead')).toBeVisible();

    // データ行の確認
    await waitForTreeTableLoad(page);
    const rows = treeTable(page).locator('tbody tr');
    await expect.poll(async () => rows.count()).toBeGreaterThanOrEqual(1);

    // TreeTable の基本構造確認
    await expect(treeTable(page)).toBeVisible();
    await expect(treeTable(page).locator('tbody')).toBeVisible();
  });

  test('カラム表示と基本構造', async ({ page }) => {
    await waitForTreeTableLoad(page);

    // 標準カラムの表示確認
    await expect(page.locator('th:has-text("Name"), th:has-text("名前")')).toBeVisible();
    await expect(page.locator('th:has-text("Type"), th:has-text("種類")')).toBeVisible();
    await expect(page.locator('th:has-text("Updated"), th:has-text("更新日時")')).toBeVisible();

    // カラムヘッダーの基本属性確認
    const nameColumn = page
      .locator('th')
      .filter({ hasText: /Name|名前/ })
      .first();
    await expect(nameColumn).toBeVisible();
    await expect(nameColumn).toHaveAttribute('role', 'columnheader');

    // テーブルの基本構造確認
    await expect(page.locator('table')).toHaveAttribute('role', 'table');
    await expect(page.locator('thead')).toBeVisible();
    await expect(page.locator('tbody')).toBeVisible();
  });

  test('ローディング状態の表示', async ({ page }) => {
    // ネットワークを遅延させてローディング状態をテスト
    await page.route('**/api/tree/**', async (route) => {
      await page.waitForTimeout(1000);
      await route.continue();
    });

    await page.goto(buildAppUrl('d/r'));

    // ローディングスピナーの確認
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();

    // ローディング完了後の確認
    await waitForTreeTableLoad(page);
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    await expect(treeTable(page)).toBeVisible();
  });

  test('エラー状態のハンドリング', async ({ page }) => {
    // API エラーをシミュレート
    await page.route('**/api/tree/**', (route) => route.abort());

    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);

    // エラーメッセージの表示確認
    await expect(
      page.locator('[data-testid="error-message"], [data-testid="error-atoms"]')
    ).toBeVisible({ timeout: 10000 });

    // リトライボタンの確認
    await expect(
      page.locator('[data-testid="retry-button"], [data-testid="refresh-button"]')
    ).toBeVisible();
  });

  test('空の状態の表示', async ({ page }) => {
    // 空のデータを返すようにモック
    await page.route('**/api/tree/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], totalCount: 0 }),
      });
    });

    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // 空状態メッセージの確認
    await expect(treeTable(page).locator('tbody')).toContainText(
      /No data|No items to display|データがありません/
    );
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // デスクトップビューポートでの確認
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(treeTable(page)).toBeVisible();

    // タブレットビューポートでの確認
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(treeTable(page)).toBeVisible();

    // モバイルビューポートでの確認
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(treeTable(page)).toBeVisible();

    // モバイルでは一部カラムが非表示になることを確認
    const columns = page.locator('th');
    const columnCount = await columns.count();
    expect(columnCount).toBeLessThanOrEqual(3); // モバイルでは3カラム以下
  });

  test('アクセシビリティ基本要件', async ({ page }) => {
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // WAI-ARIA 属性の確認
    await expect(treeTable(page)).toBeVisible();
    await expect(page.getByRole('columnheader').first()).toBeVisible();
    await expect(page.getByRole('cell').first()).toBeVisible();

    // キーボードナビゲーションの基本確認
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // スクリーンリーダー用のラベル確認
    await expect(page.locator('[aria-label]').first()).toBeVisible();
  });

  test('パフォーマンス基本要件', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    const loadTime = Date.now() - startTime;

    // 初期表示は3秒以内
    expect(loadTime).toBeLessThan(3000);

    // メモリリークの基本チェック
    const initialMemory = await page.evaluate(() => {
      const performanceWithMemory = window.performance as PerformanceWithMemory;
      return performanceWithMemory.memory?.usedJSHeapSize || 0;
    });

    // ページを何度かリロード
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await dismissGuidedTour(page);
      await waitForTreeTableLoad(page);
    }

    const finalMemory = await page.evaluate(() => {
      const performanceWithMemory = window.performance as PerformanceWithMemory;
      return performanceWithMemory.memory?.usedJSHeapSize || 0;
    });

    // メモリ使用量の異常な増加がないことを確認
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      const increaseRatio = memoryIncrease / initialMemory;
      expect(increaseRatio).toBeLessThan(2.0); // 2倍以下の増加
    }
  });

  test('ツールバーとフッターの表示', async ({ page }) => {
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // ツールバーの確認
    await expect(page.getByLabel('ツリーコンソールツールバー')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'ツリー検索' })).toBeVisible();

    // フッターの確認
    await expect(page.locator('p').filter({ hasText: /^\d+\s*\/\s*\d+$/u })).toBeVisible();
  });

  test('ブレッドクラムナビゲーションの表示', async ({ page }) => {
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // ブレッドクラムの基本表示確認
    await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Resources/ })).toBeVisible();
  });

  test('テーマとスタイリングの確認', async ({ page }) => {
    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // Material-UI テーマの適用確認
    const table = treeTable(page);

    // CSS カスタムプロパティの確認
    const computedStyle = await table.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontFamily: style.fontFamily,
      };
    });

    // 基本的なスタイルが適用されていることを確認
    expect(computedStyle.backgroundColor).toBeTruthy();
    expect(computedStyle.color).toBeTruthy();
    expect(computedStyle.fontFamily).toBeTruthy();
  });

  test('コンソールエラーがないことの確認', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(buildAppUrl('d/r'));
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);

    // 重要でないエラーを除外
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') && !error.includes('sourcemap') && !error.includes('404')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
