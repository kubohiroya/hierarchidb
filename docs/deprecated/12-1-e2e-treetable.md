# 12.1 TreeTable E2Eテスト仕様

## 概要

本ドキュメントは、HierarchiDBのTreeTableコンポーネント（`@hierarchidb/ui-treeconsole`）におけるE2Eテストの実装仕様を定義します。旧実装で95%のカバレッジを達成したE2Eテストを参考に、新アーキテクチャに最適化されたテスト戦略を策定します。

**対象コンポーネント**: TreeConsolePanel, TreeTableView, TreeTableOrchestrator  
**テストフレームワーク**: Playwright  
**カバレッジ目標**: 95%以上

## テスト分類

### 1. 基本表示・ナビゲーション機能
| 機能 | 優先度 | 説明 | 実装予定ファイル |
|-----|-------|------|-----------------|
| 初期表示 | 高 | TreeTable の初期レンダリング | `treetable-basic-display.e2e.ts` |
| ブレッドクラム | 高 | パス表示とナビゲーション | `treetable-breadcrumb.e2e.ts` |
| ページネーション | 中 | 大量データの分割表示 | `treetable-pagination.e2e.ts` |
| 仮想スクロール | 高 | TanStack Virtual による最適化 | `treetable-virtual-scroll.e2e.ts` |
| 検索・フィルタ | 高 | リアルタイム検索とフィルタリング | `treetable-search-filter.e2e.ts` |

### 2. ツリー操作機能
| 機能 | 優先度 | 説明 | 実装予定ファイル |
|-----|-------|------|-----------------|
| 展開・折りたたみ | 高 | ノードの階層表示制御 | `treetable-expansion.e2e.ts` |
| 選択操作 | 高 | 単一・複数選択、全選択 | `treetable-selection.e2e.ts` |
| ソート | 中 | カラム別ソート機能 | `treetable-sorting.e2e.ts` |
| コンテキストメニュー | 高 | 右クリックメニュー表示 | `treetable-context-menu.e2e.ts` |
| ドラッグ&ドロップ | 高 | ノード移動と階層変更 | `treetable-drag-drop.e2e.ts` |

### 3. 高度な機能・統合
| 機能 | 優先度 | 説明 | 実装予定ファイル |
|-----|-------|------|-----------------|
| SubTree Subscription | 高 | リアルタイム更新同期 | `treetable-realtime-sync.e2e.ts` |
| Working Copy | 高 | 編集セッション管理 | `treetable-working-copy.e2e.ts` |
| Undo/Redo | 高 | 操作の取り消し・やり直し | `treetable-undo-redo.e2e.ts` |
| キーボードナビゲーション | 中 | アクセシビリティ対応 | `treetable-keyboard-nav.e2e.ts` |
| パフォーマンス | 中 | 大量データでの動作確認 | `treetable-performance.e2e.ts` |

## 詳細テスト仕様

### treetable-basic-display.e2e.ts

**目的**: TreeTableの基本表示機能の検証

**テストケース**:
```typescript
describe('TreeTable Basic Display', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);
  });

  test('初期表示とレンダリング', async ({ page }) => {
    // TreeTable コンポーネントの表示確認
    await expect(page.locator('[data-testid="tree-table"]')).toBeVisible();
    
    // ヘッダー行の確認
    await expect(page.locator('[data-testid="tree-table-header"]')).toBeVisible();
    
    // データ行の確認
    await expect(page.locator('[data-testid="tree-table-row"]')).toHaveCount.atLeast(1);
  });

  test('カラム表示と幅調整', async ({ page }) => {
    // 標準カラムの表示確認
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Type")')).toBeVisible();
    await expect(page.locator('th:has-text("Updated")')).toBeVisible();

    // カラム幅調整
    const nameColumn = page.locator('th:has-text("Name")');
    await nameColumn.hover();
    const resizeHandle = page.locator('[data-testid="column-resize-handle"]');
    await resizeHandle.drag(nameColumn, { targetPosition: { x: 200, y: 0 } });
    
    // 幅変更の確認
    const columnWidth = await nameColumn.evaluate(el => el.getBoundingClientRect().width);
    expect(columnWidth).toBeGreaterThan(180);
  });

  test('ローディング状態とエラーハンドリング', async ({ page }) => {
    // ローディング状態の確認
    await page.route('**/api/tree/**', async route => {
      await page.waitForTimeout(1000);
      await route.continue();
    });

    await page.reload();
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // エラー状態のテスト
    await page.route('**/api/tree/**', route => route.abort());
    await page.reload();
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
```

### treetable-expansion.e2e.ts

**目的**: ノードの展開・折りたたみ機能の検証

**テストケース**:
```typescript
describe('TreeTable Expansion', () => {
  test('個別ノードの展開・折りたたみ', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // 折りたたまれた状態の確認
    const parentNode = page.locator('[data-testid="tree-node"][data-has-children="true"]').first();
    await expect(parentNode.locator('[data-testid="expand-icon"]')).toHaveAttribute('data-expanded', 'false');

    // ノード展開
    await parentNode.locator('[data-testid="expand-button"]').click();
    await expect(parentNode.locator('[data-testid="expand-icon"]')).toHaveAttribute('data-expanded', 'true');

    // 子ノードの表示確認
    await expect(page.locator('[data-testid="tree-node"][data-parent-id]')).toHaveCount.atLeast(1);

    // ノード折りたたみ
    await parentNode.locator('[data-testid="expand-button"]').click();
    await expect(parentNode.locator('[data-testid="expand-icon"]')).toHaveAttribute('data-expanded', 'false');
    await expect(page.locator('[data-testid="tree-node"][data-parent-id]')).toHaveCount(0);
  });

  test('全展開・全折りたたみ', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // 全展開
    await page.locator('[data-testid="expand-all-button"]').click();
    
    // すべての親ノードが展開されていることを確認
    const expandableNodes = page.locator('[data-testid="tree-node"][data-has-children="true"]');
    const expandedCount = await expandableNodes.count();
    
    for (let i = 0; i < expandedCount; i++) {
      await expect(expandableNodes.nth(i).locator('[data-testid="expand-icon"]'))
        .toHaveAttribute('data-expanded', 'true');
    }

    // 全折りたたみ
    await page.locator('[data-testid="collapse-all-button"]').click();
    
    // すべての親ノードが折りたたまれていることを確認
    for (let i = 0; i < expandedCount; i++) {
      await expect(expandableNodes.nth(i).locator('[data-testid="expand-icon"]'))
        .toHaveAttribute('data-expanded', 'false');
    }
  });

  test('展開状態の永続化', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // ノード展開
    const parentNode = page.locator('[data-testid="tree-node"][data-has-children="true"]').first();
    await parentNode.locator('[data-testid="expand-button"]').click();
    
    const nodeId = await parentNode.getAttribute('data-node-id');

    // ページリロード
    await page.reload();
    await dismissGuidedTour(page);

    // 展開状態が維持されていることを確認
    const reloadedNode = page.locator(`[data-testid="tree-node"][data-node-id="${nodeId}"]`);
    await expect(reloadedNode.locator('[data-testid="expand-icon"]'))
      .toHaveAttribute('data-expanded', 'true');
  });
});
```

### treetable-drag-drop.e2e.ts

**目的**: ドラッグ&ドロップによるノード移動の検証

**テストケース**:
```typescript
describe('TreeTable Drag and Drop', () => {
  test('ノードの移動操作', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // ドラッグ対象ノードの特定
    const sourceNode = page.locator('[data-testid="tree-node"]').first();
    const targetNode = page.locator('[data-testid="tree-node"]').nth(2);

    const sourceId = await sourceNode.getAttribute('data-node-id');
    const targetId = await targetNode.getAttribute('data-node-id');

    // ドラッグ開始
    await sourceNode.hover();
    await page.mouse.down();

    // ドラッグ中の視覚的フィードバック確認
    await expect(page.locator('[data-testid="drag-overlay"]')).toBeVisible();
    await expect(sourceNode).toHaveClass(/dragging/);

    // ドロップターゲットへ移動
    await targetNode.hover();
    await expect(targetNode).toHaveClass(/drop-target/);

    // ドロップ実行
    await page.mouse.up();

    // 移動の確認
    await expect(page.locator(`[data-testid="tree-node"][data-node-id="${sourceId}"]`))
      .toHaveAttribute('data-parent-id', targetId);

    // 確認ダイアログの処理
    await expect(page.locator('[data-testid="move-confirmation-dialog"]')).toBeVisible();
    await page.locator('[data-testid="confirm-move-button"]').click();

    // SubTree更新の確認
    await page.waitForTimeout(500); // SubTree subscription の更新待ち
    await expect(page.locator(`[data-testid="tree-node"][data-node-id="${sourceId}"]`))
      .toHaveAttribute('data-parent-id', targetId);
  });

  test('移動制約の確認', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // 循環参照の防止テスト
    const parentNode = page.locator('[data-testid="tree-node"][data-has-children="true"]').first();
    await parentNode.locator('[data-testid="expand-button"]').click();
    
    const childNode = page.locator('[data-testid="tree-node"][data-parent-id]').first();
    
    // 子ノードを親ノードにドロップしようとする
    await childNode.hover();
    await page.mouse.down();
    await parentNode.hover();

    // 無効なドロップターゲットの表示確認
    await expect(parentNode).toHaveClass(/drop-invalid/);
    await expect(page.locator('[data-testid="drop-error-tooltip"]')).toBeVisible();

    await page.mouse.up();

    // 移動が実行されないことを確認
    const originalParentId = await childNode.getAttribute('data-parent-id');
    await page.waitForTimeout(200);
    await expect(childNode).toHaveAttribute('data-parent-id', originalParentId);
  });

  test('複数ノードの一括移動', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // 複数ノード選択
    const firstNode = page.locator('[data-testid="tree-node"]').first();
    const secondNode = page.locator('[data-testid="tree-node"]').nth(1);
    const targetNode = page.locator('[data-testid="tree-node"]').nth(3);

    // Ctrlキーを押しながら複数選択
    await firstNode.locator('[data-testid="node-checkbox"]').click();
    await page.keyboard.down('Control');
    await secondNode.locator('[data-testid="node-checkbox"]').click();
    await page.keyboard.up('Control');

    // 選択されたノードのドラッグ
    await firstNode.hover();
    await page.mouse.down();
    await targetNode.hover();
    await page.mouse.up();

    // 複数ノード移動の確認ダイアログ
    await expect(page.locator('[data-testid="bulk-move-dialog"]')).toBeVisible();
    await expect(page.locator('[data-testid="move-count"]')).toHaveText('2');
    await page.locator('[data-testid="confirm-bulk-move-button"]').click();

    // 両方のノードが移動したことを確認
    const targetId = await targetNode.getAttribute('data-node-id');
    await expect(firstNode).toHaveAttribute('data-parent-id', targetId);
    await expect(secondNode).toHaveAttribute('data-parent-id', targetId);
  });
});
```

### treetable-realtime-sync.e2e.ts

**目的**: SubTree Subscription によるリアルタイム更新の検証

**テストケース**:
```typescript
describe('TreeTable Realtime Sync', () => {
  test('SubTree更新の受信', async ({ page, context }) => {
    // 2つのページを開く（同じユーザーの複数タブをシミュレート）
    const page1 = page;
    const page2 = await context.newPage();

    await page1.goto('/treeconsole');
    await page2.goto('/treeconsole');
    
    await dismissGuidedTour(page1);
    await dismissGuidedTour(page2);

    // 同じサブツリーを表示していることを確認
    await expect(page1.locator('[data-testid="tree-table"]')).toBeVisible();
    await expect(page2.locator('[data-testid="tree-table"]')).toBeVisible();

    // Page1で新規ノード作成
    await page1.locator('[data-testid="create-node-button"]').click();
    await page1.locator('[data-testid="node-name-input"]').fill('Test Node');
    await page1.locator('[data-testid="create-confirm-button"]').click();

    // Page2でリアルタイム更新を確認
    await expect(page2.locator('[data-testid="tree-node"]:has-text("Test Node")')).toBeVisible({ timeout: 5000 });

    // Page2でノード削除
    await page2.locator('[data-testid="tree-node"]:has-text("Test Node")').click({ button: 'right' });
    await page2.locator('[data-testid="context-menu-delete"]').click();
    await page2.locator('[data-testid="delete-confirm-button"]').click();

    // Page1で削除の反映を確認
    await expect(page1.locator('[data-testid="tree-node"]:has-text("Test Node")')).not.toBeVisible({ timeout: 5000 });
  });

  test('購読の自動再接続', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // ネットワーク切断をシミュレート
    await page.route('**/ws/**', route => route.abort());
    
    // 接続断の表示確認
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Disconnected');

    // ネットワーク復旧
    await page.unroute('**/ws/**');

    // 自動再接続の確認
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 10000 });

    // データ同期の復旧確認
    await page.locator('[data-testid="refresh-button"]').click();
    await expect(page.locator('[data-testid="tree-table-row"]')).toHaveCount.atLeast(1);
  });

  test('部分的SubTree更新', async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);

    // 特定のサブツリーのみを展開
    const parentNode = page.locator('[data-testid="tree-node"][data-has-children="true"]').first();
    await parentNode.locator('[data-testid="expand-button"]').click();
    
    const parentId = await parentNode.getAttribute('data-node-id');

    // サブツリー内でのノード変更をシミュレート
    await page.evaluate((nodeId) => {
      // Worker APIを直接呼び出してサブツリー更新を送信
      window.workerAPI?.publishSubTreeUpdate?.({
        rootNodeId: nodeId,
        changes: {
          updated: [{
            nodeId: nodeId + '_child_1',
            changes: { name: 'Updated Child Node' }
          }]
        }
      });
    }, parentId);

    // 該当サブツリーのみが更新されることを確認
    await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("Updated Child Node")`))
      .toBeVisible({ timeout: 3000 });

    // 他のサブツリーは影響を受けないことを確認
    const otherNodes = page.locator('[data-testid="tree-node"]').filter({ hasNot: page.locator(`[data-parent-id="${parentId}"]`) });
    const initialCount = await otherNodes.count();
    await page.waitForTimeout(1000);
    await expect(otherNodes).toHaveCount(initialCount);
  });
});
```

## テスト実行環境

### ブラウザサポート
- **Chromium**: フル機能テスト
- **Firefox**: フル機能テスト  
- **WebKit**: 基本機能テスト（一部制限あり）

### テストデータ
- **小規模データセット**: 10-50ノード（基本機能テスト用）
- **中規模データセット**: 100-1000ノード（パフォーマンステスト用）
- **大規模データセット**: 5000+ノード（仮想スクロールテスト用）

### パフォーマンス基準
- **初期表示**: 2秒以内
- **ノード展開**: 500ms以内
- **検索結果表示**: 1秒以内
- **ドラッグ&ドロップ**: 応答性60fps

## 実装スケジュール

### Phase 1: 基本機能（優先度: 高）
- Week 1-2: `treetable-basic-display.e2e.ts`
- Week 2-3: `treetable-expansion.e2e.ts`
- Week 3-4: `treetable-selection.e2e.ts`

### Phase 2: 高度な機能（優先度: 高）
- Week 4-5: `treetable-drag-drop.e2e.ts`
- Week 5-6: `treetable-realtime-sync.e2e.ts`
- Week 6-7: `treetable-undo-redo.e2e.ts`

### Phase 3: 補完機能（優先度: 中）
- Week 7-8: `treetable-search-filter.e2e.ts`
- Week 8-9: `treetable-context-menu.e2e.ts`
- Week 9-10: `treetable-performance.e2e.ts`

## 注意事項とベストプラクティス

### 1. テストの安定性確保
- 適切な待機条件の設定（SubTree更新の完了待ち）
- データ競合状態の回避
- フレイキーテストの予防

### 2. パフォーマンス考慮
- 仮想スクロールのテスト対応
- 大量データでのメモリリーク検出
- レンダリングパフォーマンスの測定

### 3. アクセシビリティ
- キーボードナビゲーションの確認
- スクリーンリーダー対応の検証
- ARIAラベルの適切性確認

### 4. クロスブラウザ対応
- WebKitでの制限事項の文書化
- ブラウザ固有の動作差異の対応
- 必要に応じたpolyfillのテスト