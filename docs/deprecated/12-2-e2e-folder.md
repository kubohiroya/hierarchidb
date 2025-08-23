# 12.2 フォルダ機能 E2Eテスト仕様

## 概要

本ドキュメントは、HierarchiDBのフォルダ機能（`@hierarchidb/plugins/folder`）におけるE2Eテストの実装仕様を定義します。旧実装で95%のカバレッジを達成したフォルダ操作のE2Eテストを参考に、新プラグインシステムに最適化されたテスト戦略を策定します。

**対象プラグイン**: Folder Plugin (`@hierarchidb/plugins/folder`)  
**テストフレームワーク**: Playwright  
**カバレッジ目標**: 95%以上（旧実装準拠）

## テスト対象操作一覧

旧実装での14操作をベースに、新プラグインシステムに対応した操作一覧を定義：

| 操作 | UI トリガー | 優先度 | 実装予定ファイル | 旧実装カバレッジ |
|-----|------------|-------|-----------------|-----------------|
| フォルダ作成 | SpeedDial / Create Menu | 高 | `folder-crud-operations.e2e.ts` | ✅ 完全 |
| 名前変更（編集） | Context Menu → Edit | 高 | `folder-crud-operations.e2e.ts` | ✅ 基本 |
| 複製 | Context Menu → Duplicate (⌘+D) | 中 | `folder-advanced-operations.e2e.ts` | ⚠️ 部分的 |
| コピー | Context Menu → Copy (⌘+C) | 高 | `folder-clipboard-operations.e2e.ts` | ✅ 基本 |
| ペースト | Context Menu → Paste (⌘+V) | 高 | `folder-clipboard-operations.e2e.ts` | ✅ 基本 |
| 移動（ドラッグ&ドロップ） | Mouse操作 | 高 | `folder-drag-drop.e2e.ts` | ✅ 完全 |
| ゴミ箱へ移動 | Context Menu → Remove (⌘+X) | 高 | `folder-trash-operations.e2e.ts` | ✅ 完全 |
| ゴミ箱から戻す | Trash → Restore | 高 | `folder-trash-operations.e2e.ts` | ✅ 完全 |
| ゴミ箱から削除 | Trash → Delete Permanently | 高 | `folder-trash-operations.e2e.ts` | ✅ 完全 |
| インポート | Import Menu → JSON File | 中 | `folder-import-export.e2e.ts` | ✅ 完全 |
| テンプレートインポート | Import Menu → Templates | 中 | `folder-template-operations.e2e.ts` | ✅ 完全 |
| エクスポート | Export Menu → JSON File | 中 | `folder-import-export.e2e.ts` | ✅ 完全 |
| Undo | Undo (⌘+Z) | 高 | `folder-undo-redo.e2e.ts` | ✅ 完全 |
| Redo | Redo (⌘+Shift+Z) | 高 | `folder-undo-redo.e2e.ts` | ✅ 完全 |

## 詳細テスト仕様

### folder-crud-operations.e2e.ts

**目的**: フォルダのCRUD操作（作成・読み取り・更新・削除）の包括的テスト

**テストケース**:
```typescript
describe('Folder CRUD Operations', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  describe('フォルダ作成', () => {
    test('SpeedDialからのフォルダ作成', async ({ page }) => {
      // SpeedDial ボタンをクリック
      await page.locator('[data-testid="speed-dial-fab"]').click();
      await expect(page.locator('[data-testid="speed-dial-menu"]')).toBeVisible();

      // フォルダ作成オプションを選択
      await page.locator('[data-testid="create-folder-action"]').click();

      // フォルダ作成ダイアログの確認
      await expect(page.locator('[data-testid="folder-create-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="folder-name-input"]')).toBeFocused();

      // フォルダ名入力
      const folderName = `Test Folder ${Date.now()}`;
      await page.locator('[data-testid="folder-name-input"]').fill(folderName);

      // 説明の入力（オプション）
      await page.locator('[data-testid="folder-description-input"]')
        .fill('E2E テスト用フォルダです');

      // 作成ボタンクリック
      await page.locator('[data-testid="create-folder-confirm"]').click();

      // ダイアログの閉じるのを待つ
      await expect(page.locator('[data-testid="folder-create-dialog"]')).not.toBeVisible();

      // 新しいフォルダがツリーに表示されることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .toBeVisible({ timeout: 5000 });

      // フォルダアイコンの確認
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
      await expect(folderNode.locator('[data-testid="folder-icon"]')).toBeVisible();

      // Working Copy の作成確認
      await expect(page.locator('[data-testid="working-copy-indicator"]')).toBeVisible();
    });

    test('コンテキストメニューからのフォルダ作成', async ({ page }) => {
      // 親フォルダを右クリック
      const parentFolder = page.locator('[data-testid="tree-node"][data-node-type="folder"]').first();
      await parentFolder.click({ button: 'right' });

      // コンテキストメニューの表示確認
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Create サブメニューを開く
      await page.locator('[data-testid="context-menu-create"]').hover();
      await expect(page.locator('[data-testid="create-submenu"]')).toBeVisible();

      // フォルダ作成を選択
      await page.locator('[data-testid="create-submenu-folder"]').click();

      // フォルダ作成フローの確認（上記と同様）
      await expect(page.locator('[data-testid="folder-create-dialog"]')).toBeVisible();
      
      const folderName = `Child Folder ${Date.now()}`;
      await page.locator('[data-testid="folder-name-input"]').fill(folderName);
      await page.locator('[data-testid="create-folder-confirm"]').click();

      // 親フォルダ内に子フォルダが作成されることを確認
      const parentId = await parentFolder.getAttribute('data-node-id');
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${folderName}")`))
        .toBeVisible({ timeout: 5000 });
    });

    test('フォルダ作成時のバリデーション', async ({ page }) => {
      await page.locator('[data-testid="speed-dial-fab"]').click();
      await page.locator('[data-testid="create-folder-action"]').click();

      // 空の名前でのエラー確認
      await page.locator('[data-testid="create-folder-confirm"]').click();
      await expect(page.locator('[data-testid="name-error"]')).toHaveText('フォルダ名は必須です');

      // 長すぎる名前でのエラー確認
      const longName = 'a'.repeat(256);
      await page.locator('[data-testid="folder-name-input"]').fill(longName);
      await expect(page.locator('[data-testid="name-error"]')).toHaveText('フォルダ名は255文字以下である必要があります');

      // 無効な文字でのエラー確認
      await page.locator('[data-testid="folder-name-input"]').fill('folder/with\\invalid:chars');
      await expect(page.locator('[data-testid="name-error"]')).toHaveText('フォルダ名に無効な文字が含まれています');

      // 重複名でのエラー確認
      await page.locator('[data-testid="folder-name-input"]').fill('Documents'); // 既存フォルダ名
      await page.locator('[data-testid="create-folder-confirm"]').click();
      await expect(page.locator('[data-testid="name-error"]')).toHaveText('同名のフォルダが既に存在します');
    });
  });

  describe('フォルダ編集', () => {
    test('名前変更操作', async ({ page }) => {
      // テスト用フォルダを作成
      const originalName = await createTestFolder(page, 'Original Folder');
      
      // フォルダを右クリック
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`);
      await folderNode.click({ button: 'right' });

      // 編集メニューを選択
      await page.locator('[data-testid="context-menu-edit"]').click();

      // 編集ダイアログの確認
      await expect(page.locator('[data-testid="folder-edit-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="folder-name-input"]')).toHaveValue(originalName);

      // 名前を変更
      const newName = `Renamed Folder ${Date.now()}`;
      await page.locator('[data-testid="folder-name-input"]').clear();
      await page.locator('[data-testid="folder-name-input"]').fill(newName);

      // 説明も更新
      await page.locator('[data-testid="folder-description-input"]')
        .fill('名前変更されたフォルダです');

      // 変更を保存
      await page.locator('[data-testid="save-folder-changes"]').click();

      // ダイアログが閉じることを確認
      await expect(page.locator('[data-testid="folder-edit-dialog"]')).not.toBeVisible();

      // 新しい名前でフォルダが表示されることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${newName}")`))
        .toBeVisible({ timeout: 5000 });

      // 古い名前のフォルダが存在しないことを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${originalName}")`))
        .not.toBeVisible();

      // Working Copy の更新確認
      await expect(page.locator('[data-testid="working-copy-indicator"]')).toBeVisible();
    });

    test('編集時のリアルタイムバリデーション', async ({ page }) => {
      const folderName = await createTestFolder(page, 'Test Folder');
      
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
      await folderNode.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-edit"]').click();

      // リアルタイムバリデーションのテスト
      await page.locator('[data-testid="folder-name-input"]').clear();
      await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="save-folder-changes"]')).toBeDisabled();

      // 有効な名前を入力
      await page.locator('[data-testid="folder-name-input"]').fill('Valid Name');
      await expect(page.locator('[data-testid="name-error"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="save-folder-changes"]')).toBeEnabled();
    });
  });

  describe('フォルダ削除', () => {
    test('ゴミ箱への移動', async ({ page }) => {
      const folderName = await createTestFolder(page, 'Folder to Delete');
      
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
      await folderNode.click({ button: 'right' });

      // 削除メニューを選択
      await page.locator('[data-testid="context-menu-remove"]').click();

      // 確認ダイアログの表示
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-message"]'))
        .toHaveText(/フォルダ ".*" をゴミ箱に移動しますか？/);

      // 削除を確認
      await page.locator('[data-testid="confirm-delete"]').click();

      // フォルダがメインビューから消えることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .not.toBeVisible({ timeout: 5000 });

      // ゴミ箱に移動したことを確認
      await page.locator('[data-testid="trash-navigation"]').click();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`))
        .toBeVisible();
    });

    test('削除のキャンセル', async ({ page }) => {
      const folderName = await createTestFolder(page, 'Folder to Keep');
      
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
      await folderNode.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-remove"]').click();

      // キャンセルボタンをクリック
      await page.locator('[data-testid="cancel-delete"]').click();

      // フォルダが残っていることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .toBeVisible();

      // ダイアログが閉じることを確認
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    });
  });
});

// ヘルパー関数
async function createTestFolder(page: Page, name: string): Promise<string> {
  const timestamp = Date.now();
  const folderName = `${name} ${timestamp}`;
  
  await page.locator('[data-testid="speed-dial-fab"]').click();
  await page.locator('[data-testid="create-folder-action"]').click();
  await page.locator('[data-testid="folder-name-input"]').fill(folderName);
  await page.locator('[data-testid="create-folder-confirm"]').click();
  
  await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
    .toBeVisible({ timeout: 5000 });
  
  return folderName;
}

async function waitForTreeTableLoad(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="tree-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
}
```

### folder-drag-drop.e2e.ts

**目的**: ドラッグ&ドロップによるフォルダ移動の包括的テスト（旧実装の694行を参考）

**テストケース**:
```typescript
describe('Folder Drag and Drop Operations', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  describe('基本的なドラッグ&ドロップ', () => {
    test('フォルダの単純な移動', async ({ page }) => {
      // テスト用フォルダ構造を作成
      const sourceFolder = await createTestFolder(page, 'Source Folder');
      const targetFolder = await createTestFolder(page, 'Target Folder');

      // ドラッグ操作の実行
      const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

      // ドラッグ開始
      await sourceNode.hover();
      await page.mouse.down();

      // ドラッグ中の視覚的フィードバック確認
      await expect(page.locator('[data-testid="drag-overlay"]')).toBeVisible();
      await expect(sourceNode).toHaveClass(/dragging/);
      await expect(page.locator('[data-testid="drag-preview"]')).toContainText(sourceFolder);

      // ドロップターゲットへの移動
      await targetNode.hover();
      
      // ドロップ可能な状態の確認
      await expect(targetNode).toHaveClass(/drop-target-valid/);
      await expect(page.locator('[data-testid="drop-indicator"]')).toBeVisible();

      // ドロップ実行
      await page.mouse.up();

      // 移動確認ダイアログの処理
      await expect(page.locator('[data-testid="move-confirmation-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="move-source"]')).toHaveText(sourceFolder);
      await expect(page.locator('[data-testid="move-target"]')).toHaveText(targetFolder);
      
      await page.locator('[data-testid="confirm-move"]').click();

      // 移動の結果確認
      await page.waitForTimeout(1000); // SubTree更新の待機

      // ターゲットフォルダを展開
      const targetNodeAfterMove = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);
      await targetNodeAfterMove.locator('[data-testid="expand-button"]').click();

      // ソースフォルダがターゲットフォルダの子になったことを確認
      const targetId = await targetNodeAfterMove.getAttribute('data-node-id');
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${sourceFolder}")`))
        .toBeVisible();

      // 元の場所にソースフォルダが存在しないことを確認
      const rootLevelSourceNodes = page.locator(`[data-testid="tree-node"][data-parent-id=""]:has-text("${sourceFolder}")`);
      await expect(rootLevelSourceNodes).toHaveCount(0);
    });

    test('ネストされたフォルダの移動', async ({ page }) => {
      // 階層構造の作成
      const parentFolder = await createTestFolder(page, 'Parent Folder');
      
      // 親フォルダを展開
      const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);
      await parentNode.click(); // 選択してから子フォルダを作成
      
      const childFolder = await createChildFolder(page, parentNode, 'Child Folder');
      const targetFolder = await createTestFolder(page, 'Target Folder');

      // 子フォルダを別の場所に移動
      const childNode = page.locator(`[data-testid="tree-node"]:has-text("${childFolder}")`);
      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

      await performDragDrop(page, childNode, targetNode);

      // 移動確認ダイアログでの確認
      await page.locator('[data-testid="confirm-move"]').click();
      await page.waitForTimeout(1000);

      // 結果の確認
      await targetNode.locator('[data-testid="expand-button"]').click();
      const targetId = await targetNode.getAttribute('data-node-id');
      
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${childFolder}")`))
        .toBeVisible();

      // 元の親フォルダから削除されたことを確認
      await parentNode.locator('[data-testid="expand-button"]').click();
      const parentId = await parentNode.getAttribute('data-node-id');
      
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childFolder}")`))
        .not.toBeVisible();
    });
  });

  describe('制約とバリデーション', () => {
    test('循環参照の防止', async ({ page }) => {
      // 親子関係のあるフォルダを作成
      const parentFolder = await createTestFolder(page, 'Parent Folder');
      const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);
      await parentNode.click();
      
      const childFolder = await createChildFolder(page, parentNode, 'Child Folder');
      const childNode = page.locator(`[data-testid="tree-node"]:has-text("${childFolder}")`);

      // 子フォルダを親フォルダに移動しようとする（循環参照）
      await childNode.hover();
      await page.mouse.down();
      await parentNode.hover();

      // 無効なドロップターゲットの表示確認
      await expect(parentNode).toHaveClass(/drop-target-invalid/);
      await expect(page.locator('[data-testid="drop-error-tooltip"]')).toBeVisible();
      await expect(page.locator('[data-testid="drop-error-tooltip"]'))
        .toHaveText('循環参照は許可されません');

      // ドロップの実行（失敗するはず）
      await page.mouse.up();

      // エラーダイアログの表示確認
      await expect(page.locator('[data-testid="move-error-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]'))
        .toHaveText('循環参照が発生するため、この操作は実行できません');

      await page.locator('[data-testid="close-error-dialog"]').click();

      // フォルダが移動していないことを確認
      await parentNode.locator('[data-testid="expand-button"]').click();
      const parentId = await parentNode.getAttribute('data-node-id');
      
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${parentId}"]:has-text("${childFolder}")`))
        .toBeVisible(); // 元の場所に残っている
    });

    test('読み取り専用フォルダへの移動制限', async ({ page }) => {
      // 読み取り専用フォルダと通常フォルダを作成
      const readOnlyFolder = await createTestFolder(page, 'ReadOnly Folder');
      const sourceFolder = await createTestFolder(page, 'Source Folder');

      // 読み取り専用にマーク（テスト用のAPI呼び出し）
      await page.evaluate(async (folderName) => {
        const folderNode = document.querySelector(`[data-testid="tree-node"]:has-text("${folderName}")`);
        const nodeId = folderNode?.getAttribute('data-node-id');
        if (nodeId) {
          await window.workerAPI.updateNode(nodeId, { readOnly: true });
        }
      }, readOnlyFolder);

      // 読み取り専用フォルダへの移動を試行
      const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`);
      const readOnlyNode = page.locator(`[data-testid="tree-node"]:has-text("${readOnlyFolder}")`);

      await sourceNode.hover();
      await page.mouse.down();
      await readOnlyNode.hover();

      // 読み取り専用の警告表示
      await expect(readOnlyNode).toHaveClass(/drop-target-readonly/);
      await expect(page.locator('[data-testid="readonly-warning"]')).toBeVisible();

      await page.mouse.up();

      // 権限エラーダイアログの確認
      await expect(page.locator('[data-testid="permission-error-dialog"]')).toBeVisible();
      await page.locator('[data-testid="close-error-dialog"]').click();
    });

    test('同名フォルダの移動時の競合解決', async ({ page }) => {
      // 同名のフォルダを2つの異なる場所に作成
      const targetFolder = await createTestFolder(page, 'Target Folder');
      const sourceFolder = await createTestFolder(page, 'Duplicate Name');
      
      // ターゲットフォルダ内にも同名のフォルダを作成
      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);
      await targetNode.click();
      const existingChild = await createChildFolder(page, targetNode, 'Duplicate Name');

      // 同名フォルダの移動を試行
      const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`).first();
      await performDragDrop(page, sourceNode, targetNode);

      // 競合解決ダイアログの表示
      await expect(page.locator('[data-testid="name-conflict-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-message"]'))
        .toHaveText('同名のフォルダが既に存在します。どのように処理しますか？');

      // オプションの確認
      await expect(page.locator('[data-testid="conflict-rename"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-replace"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-cancel"]')).toBeVisible();

      // 名前変更オプションを選択
      await page.locator('[data-testid="conflict-rename"]').click();
      
      // 新しい名前の入力
      await expect(page.locator('[data-testid="new-name-input"]')).toBeVisible();
      await page.locator('[data-testid="new-name-input"]').fill('Duplicate Name (1)');
      await page.locator('[data-testid="confirm-rename"]').click();

      // 結果の確認
      await targetNode.locator('[data-testid="expand-button"]').click();
      const targetId = await targetNode.getAttribute('data-node-id');
      
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("Duplicate Name (1)")`))
        .toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("Duplicate Name")`))
        .toBeVisible(); // 既存のフォルダも残っている
    });
  });

  describe('複数フォルダの一括移動', () => {
    test('複数選択フォルダの同時移動', async ({ page }) => {
      // 複数のテストフォルダを作成
      const folder1 = await createTestFolder(page, 'Folder 1');
      const folder2 = await createTestFolder(page, 'Folder 2');
      const folder3 = await createTestFolder(page, 'Folder 3');
      const targetFolder = await createTestFolder(page, 'Target Folder');

      // 複数フォルダを選択
      await page.keyboard.down('Control');
      await page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`).click();
      await page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`).click();
      await page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`).click();
      await page.keyboard.up('Control');

      // 選択状態の確認
      await expect(page.locator('[data-testid="selected-count"]')).toHaveText('3 items selected');

      // 一括ドラッグ&ドロップ
      const firstSelected = page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`);
      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

      await firstSelected.hover();
      await page.mouse.down();

      // 複数アイテムのドラッグプレビュー確認
      await expect(page.locator('[data-testid="bulk-drag-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="drag-count"]')).toHaveText('3');

      await targetNode.hover();
      await page.mouse.up();

      // 一括移動の確認ダイアログ
      await expect(page.locator('[data-testid="bulk-move-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="move-item-list"]')).toContainText(folder1);
      await expect(page.locator('[data-testid="move-item-list"]')).toContainText(folder2);
      await expect(page.locator('[data-testid="move-item-list"]')).toContainText(folder3);

      await page.locator('[data-testid="confirm-bulk-move"]').click();

      // 結果の確認
      await page.waitForTimeout(2000); // 一括移動の完了待ち
      
      await targetNode.locator('[data-testid="expand-button"]').click();
      const targetId = await targetNode.getAttribute('data-node-id');

      // すべてのフォルダが移動したことを確認
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${folder1}")`))
        .toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${folder2}")`))
        .toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${folder3}")`))
        .toBeVisible();
    });
  });

  describe('パフォーマンスとアクセシビリティ', () => {
    test('大量フォルダでのドラッグ&ドロップパフォーマンス', async ({ page }) => {
      // 100個のフォルダを作成
      const folders: string[] = [];
      for (let i = 0; i < 100; i++) {
        const folderName = await createTestFolder(page, `Perf Test ${i}`);
        folders.push(folderName);
      }

      const targetFolder = await createTestFolder(page, 'Target Folder');

      // パフォーマンス測定開始
      const startTime = Date.now();

      // 最初のフォルダを移動
      const sourceNode = page.locator(`[data-testid="tree-node"]:has-text("${folders[0]}")`);
      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);

      await performDragDrop(page, sourceNode, targetNode);
      await page.locator('[data-testid="confirm-move"]').click();
      
      // 操作完了まで待機
      await page.waitForTimeout(1000);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // パフォーマンス基準（2秒以内）
      expect(duration).toBeLessThan(2000);

      // UI応答性の確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folders[1]}")`))
        .toBeVisible(); // 他のフォルダが正常に表示されている
    });

    test('キーボードアクセシビリティサポート', async ({ page }) => {
      const sourceFolder = await createTestFolder(page, 'Keyboard Source');
      const targetFolder = await createTestFolder(page, 'Keyboard Target');

      // キーボードでフォルダを選択
      await page.locator(`[data-testid="tree-node"]:has-text("${sourceFolder}")`).focus();
      await page.keyboard.press('Enter'); // 選択

      // コンテキストメニューをキーボードで開く
      await page.keyboard.press('ContextMenu');
      await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();

      // Cut操作
      await page.keyboard.press('ArrowDown'); // Cut項目に移動
      await page.keyboard.press('Enter');

      // ターゲットフォルダに移動
      await page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`).focus();
      await page.keyboard.press('ContextMenu');

      // Paste操作
      await page.keyboard.press('ArrowDown'); // Paste項目に移動
      await page.keyboard.press('Enter');

      // 移動確認
      await page.locator('[data-testid="confirm-move"]').click();
      await page.waitForTimeout(1000);

      // 結果確認
      await page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`).click();
      await page.keyboard.press('ArrowRight'); // 展開

      const targetNode = page.locator(`[data-testid="tree-node"]:has-text("${targetFolder}")`);
      const targetId = await targetNode.getAttribute('data-node-id');
      
      await expect(page.locator(`[data-testid="tree-node"][data-parent-id="${targetId}"]:has-text("${sourceFolder}")`))
        .toBeVisible();
    });
  });
});

// ヘルパー関数
async function performDragDrop(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.hover();
  await page.mouse.down();
  await target.hover();
  await page.mouse.up();
}

async function createChildFolder(page: Page, parentNode: Locator, name: string): Promise<string> {
  const timestamp = Date.now();
  const folderName = `${name} ${timestamp}`;
  
  await parentNode.click({ button: 'right' });
  await page.locator('[data-testid="context-menu-create"]').hover();
  await page.locator('[data-testid="create-submenu-folder"]').click();
  await page.locator('[data-testid="folder-name-input"]').fill(folderName);
  await page.locator('[data-testid="create-folder-confirm"]').click();
  
  return folderName;
}
```

### folder-trash-operations.e2e.ts

**目的**: ゴミ箱機能の包括的テスト（移動、復元、完全削除）

**テストケース**:
```typescript
describe('Folder Trash Operations', () => {
  beforeEach(async ({ page }) => {
    await page.goto('/treeconsole');
    await dismissGuidedTour(page);
    await waitForTreeTableLoad(page);
  });

  describe('ゴミ箱への移動', () => {
    test('単一フォルダのゴミ箱移動', async ({ page }) => {
      const folderName = await createTestFolder(page, 'Folder to Trash');
      
      // フォルダを右クリックして削除
      const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
      await folderNode.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-remove"]').click();

      // 削除確認ダイアログ
      await expect(page.locator('[data-testid="trash-confirmation-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="trash-message"]'))
        .toContainText(`"${folderName}" をゴミ箱に移動しますか？`);

      await page.locator('[data-testid="confirm-trash"]').click();

      // メインビューから削除されることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .not.toBeVisible({ timeout: 5000 });

      // ゴミ箱ビューで確認
      await page.locator('[data-testid="navigation-trash"]').click();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`))
        .toBeVisible();

      // ゴミ箱アイテムの詳細確認
      const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
      await expect(trashItem.locator('[data-testid="trash-date"]')).toBeVisible();
      await expect(trashItem.locator('[data-testid="original-path"]')).toBeVisible();
    });

    test('複数フォルダの一括ゴミ箱移動', async ({ page }) => {
      // 複数フォルダを作成
      const folder1 = await createTestFolder(page, 'Folder 1');
      const folder2 = await createTestFolder(page, 'Folder 2');
      const folder3 = await createTestFolder(page, 'Folder 3');

      // 複数選択
      await page.keyboard.down('Control');
      await page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`).click();
      await page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`).click();
      await page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`).click();
      await page.keyboard.up('Control');

      // 一括削除
      await page.keyboard.press('Delete');

      // 一括削除確認ダイアログ
      await expect(page.locator('[data-testid="bulk-trash-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="trash-count"]')).toHaveText('3');
      await page.locator('[data-testid="confirm-bulk-trash"]').click();

      // すべてのフォルダが削除されることを確認
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folder1}")`)).not.toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folder2}")`)).not.toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folder3}")`)).not.toBeVisible();

      // ゴミ箱での確認
      await page.locator('[data-testid="navigation-trash"]').click();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folder1}")`)).toBeVisible();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folder2}")`)).toBeVisible();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folder3}")`)).toBeVisible();
    });

    test('ネストされたフォルダ構造のゴミ箱移動', async ({ page }) => {
      // 階層構造を作成
      const parentFolder = await createTestFolder(page, 'Parent Folder');
      const parentNode = page.locator(`[data-testid="tree-node"]:has-text("${parentFolder}")`);
      await parentNode.click();
      
      const childFolder = await createChildFolder(page, parentNode, 'Child Folder');
      
      // 親フォルダごと削除
      await parentNode.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-remove"]').click();

      // 子フォルダも含む削除の確認
      await expect(page.locator('[data-testid="nested-trash-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="nested-count"]')).toHaveText('2'); // 親+子
      await expect(page.locator('[data-testid="nested-warning"]'))
        .toHaveText('このフォルダには子フォルダが含まれています。すべて一緒にゴミ箱に移動されます。');

      await page.locator('[data-testid="confirm-nested-trash"]').click();

      // ゴミ箱での確認
      await page.locator('[data-testid="navigation-trash"]').click();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${parentFolder}")`)).toBeVisible();
      
      // 子フォルダも個別にゴミ箱にあることを確認
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${childFolder}")`)).toBeVisible();
    });
  });

  describe('ゴミ箱からの復元', () => {
    test('単一フォルダの復元', async ({ page }) => {
      // フォルダを作成してゴミ箱に移動
      const folderName = await createTestFolder(page, 'Folder to Restore');
      await moveToTrash(page, folderName);

      // ゴミ箱ビューに移動
      await page.locator('[data-testid="navigation-trash"]').click();
      
      // フォルダを復元
      const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
      await trashItem.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-restore"]').click();

      // 復元確認ダイアログ
      await expect(page.locator('[data-testid="restore-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="restore-target"]'))
        .toHaveText('元の場所に復元します');

      await page.locator('[data-testid="confirm-restore"]').click();

      // メインビューに戻って確認
      await page.locator('[data-testid="navigation-main"]').click();
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .toBeVisible({ timeout: 5000 });

      // ゴミ箱から削除されることを確認
      await page.locator('[data-testid="navigation-trash"]').click();
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`))
        .not.toBeVisible();
    });

    test('複数フォルダの一括復元', async ({ page }) => {
      // 複数フォルダを作成してゴミ箱に移動
      const folders = ['Restore 1', 'Restore 2', 'Restore 3'];
      for (const name of folders) {
        const folderName = await createTestFolder(page, name);
        await moveToTrash(page, folderName);
      }

      // ゴミ箱ビューで一括復元
      await page.locator('[data-testid="navigation-trash"]').click();

      // 複数選択
      await page.keyboard.down('Control');
      for (const name of folders) {
        await page.locator(`[data-testid="trash-item"]:has-text("${name}")`).click();
      }
      await page.keyboard.up('Control');

      // 一括復元
      await page.locator('[data-testid="bulk-restore-button"]').click();

      // 一括復元確認
      await expect(page.locator('[data-testid="bulk-restore-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="restore-count"]')).toHaveText('3');
      await page.locator('[data-testid="confirm-bulk-restore"]').click();

      // メインビューでの確認
      await page.locator('[data-testid="navigation-main"]').click();
      for (const name of folders) {
        await expect(page.locator(`[data-testid="tree-node"]:has-text("${name}")`))
          .toBeVisible();
      }
    });

    test('復元先に同名フォルダがある場合の競合解決', async ({ page }) => {
      const folderName = 'Conflict Folder';
      
      // 同名フォルダを作成
      const original = await createTestFolder(page, folderName);
      await moveToTrash(page, original);
      
      // 新しく同名フォルダを作成
      const newFolder = await createTestFolder(page, folderName);

      // 復元を試行
      await page.locator('[data-testid="navigation-trash"]').click();
      const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
      await trashItem.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-restore"]').click();

      // 競合解決ダイアログ
      await expect(page.locator('[data-testid="restore-conflict-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="conflict-message"]'))
        .toHaveText('復元先に同名のフォルダが存在します');

      // 名前を変更して復元
      await page.locator('[data-testid="conflict-rename"]').click();
      await page.locator('[data-testid="new-name-input"]').fill(`${folderName} (Restored)`);
      await page.locator('[data-testid="confirm-rename-restore"]').click();

      // 結果確認
      await page.locator('[data-testid="navigation-main"]').click();
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName} (Restored)")`))
        .toBeVisible();
      await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
        .toBeVisible(); // 元のフォルダも残っている
    });
  });

  describe('ゴミ箱からの完全削除', () => {
    test('単一フォルダの完全削除', async ({ page }) => {
      const folderName = await createTestFolder(page, 'Folder to Delete');
      await moveToTrash(page, folderName);

      // ゴミ箱から完全削除
      await page.locator('[data-testid="navigation-trash"]').click();
      const trashItem = page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`);
      await trashItem.click({ button: 'right' });
      await page.locator('[data-testid="context-menu-delete-permanently"]').click();

      // 完全削除確認ダイアログ
      await expect(page.locator('[data-testid="permanent-delete-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="permanent-warning"]'))
        .toHaveText('この操作は取り消せません。本当に完全削除しますか？');

      await page.locator('[data-testid="confirm-permanent-delete"]').click();

      // ゴミ箱からも削除されることを確認
      await expect(page.locator(`[data-testid="trash-item"]:has-text("${folderName}")`))
        .not.toBeVisible({ timeout: 5000 });
    });

    test('ゴミ箱の一括空にする', async ({ page }) => {
      // 複数フォルダを作成してゴミ箱に移動
      const folders = ['Delete 1', 'Delete 2', 'Delete 3'];
      for (const name of folders) {
        const folderName = await createTestFolder(page, name);
        await moveToTrash(page, folderName);
      }

      // ゴミ箱を空にする
      await page.locator('[data-testid="navigation-trash"]').click();
      await page.locator('[data-testid="empty-trash-button"]').click();

      // 警告ダイアログ
      await expect(page.locator('[data-testid="empty-trash-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-warning"]'))
        .toHaveText('ゴミ箱内のすべてのアイテムが完全に削除されます。この操作は取り消せません。');

      await page.locator('[data-testid="confirm-empty-trash"]').click();

      // すべてのアイテムが削除されることを確認
      await expect(page.locator('[data-testid="trash-empty-message"]'))
        .toHaveText('ゴミ箱は空です');
      
      for (const name of folders) {
        await expect(page.locator(`[data-testid="trash-item"]:has-text("${name}")`))
          .not.toBeVisible();
      }
    });
  });
});

// ヘルパー関数
async function moveToTrash(page: Page, folderName: string): Promise<void> {
  const folderNode = page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`);
  await folderNode.click({ button: 'right' });
  await page.locator('[data-testid="context-menu-remove"]').click();
  await page.locator('[data-testid="confirm-trash"]').click();
  
  await expect(page.locator(`[data-testid="tree-node"]:has-text("${folderName}")`))
    .not.toBeVisible({ timeout: 5000 });
}
```

## 実装ガイドライン

### 1. テストデータ管理
- **クリーンアップ**: 各テスト後にテストデータの自動削除
- **分離**: テスト間のデータ競合を防ぐためのユニークな命名
- **リセット**: Working Copy のリセットとキャッシュクリア

### 2. 信頼性確保
- **待機戦略**: SubTree更新の完了を適切に待機
- **リトライ機能**: 一時的な失敗に対するリトライメカニズム
- **エラーハンドリング**: 予期しないエラーの適切な処理

### 3. パフォーマンス考慮
- **並列実行**: 独立したテストの並列実行
- **リソース管理**: メモリリークの防止
- **タイムアウト**: 適切なタイムアウト設定

### 4. メンテナビリティ
- **ページオブジェクト**: 再利用可能なヘルパー関数
- **設定管理**: 環境固有の設定の外部化
- **レポート**: 詳細なテスト結果レポート

## 実装スケジュール

### Phase 1: 基本CRUD操作（Week 1-3）
- `folder-crud-operations.e2e.ts`
- `folder-clipboard-operations.e2e.ts`

### Phase 2: 高度な操作（Week 4-6）
- `folder-drag-drop.e2e.ts`
- `folder-trash-operations.e2e.ts`

### Phase 3: 統合機能（Week 7-9）
- `folder-undo-redo.e2e.ts`
- `folder-import-export.e2e.ts`

### Phase 4: 補完・最適化（Week 10-12）
- `folder-advanced-operations.e2e.ts`
- `folder-template-operations.e2e.ts`
- パフォーマンステスト追加

## 成功基準

### カバレッジ目標
- **機能カバレッジ**: 95%以上（旧実装と同等）
- **エラーケース**: 主要なエラーシナリオの80%以上
- **ブラウザ互換性**: Chrome/Firefox完全、WebKit基本機能

### パフォーマンス基準
- **操作応答時間**: 基本操作500ms以内、複雑操作2秒以内
- **大量データ**: 1000フォルダでの安定動作
- **メモリ使用量**: 長時間実行でのメモリリーク無し

### 品質基準
- **テスト安定性**: フレイキーテスト5%以下
- **実行時間**: 全テスト15分以内
- **保守性**: 明確なテスト構造と十分なドキュメント