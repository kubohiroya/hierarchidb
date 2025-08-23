# 階層的URLパターンでのプラグインルーティングシステム - テストケース

## 1. 正常系テストケース

### 基本的なルーティング
- **テスト名**: 階層的URLパラメータの正常解析
- **入力値**: `/t/tree-123/node-456/node-789/basemap/edit`
- **期待される結果**: 
  ```typescript
  {
    treeId: "tree-123",
    pageTreeNodeId: "node-456", 
    targetTreeNodeId: "node-789",
    treeNodeType: "basemap",
    action: "edit"
  }
  ```
- **テストの目的**: React Routerのパラメータ解析が正しく動作することを確認

### プラグインコンポーネントのロード
- **テスト名**: プラグインコンポーネントの動的インポート成功
- **入力値**: `treeNodeType: "basemap", action: "edit"`
- **期待される結果**: BasemapEditComponentがレンダリングされる
- **テストの目的**: Code Splittingによる動的インポートの確認

### LoaderDataの取得
- **テスト名**: 階層情報とプラグインデータの統合取得
- **入力値**: 有効なtreeId、nodeId、プラグインタイプ
- **期待される結果**: 
  ```typescript
  {
    treeContext: { tree, currentNode, breadcrumbs, expandedNodes },
    targetNode: TreeNodeオブジェクト,
    pluginData: プラグイン固有データ,
    permissions: ["basemap:view", "basemap:edit"]
  }
  ```
- **テストの目的**: データローディングの統合テスト

## 2. 異常系テストケース

### 存在しないプラグインへのアクセス
- **テスト名**: 未登録プラグインタイプの404エラー
- **入力値**: `treeNodeType: "nonexistent"`
- **期待される結果**: 404 Not Foundページの表示
- **エラーメッセージ**: "プラグイン 'nonexistent' が見つかりません"
- **テストの目的**: 不正なルートアクセスの適切な処理

### 権限のないアクションへのアクセス
- **テスト名**: 権限不足時の403エラー表示
- **入力値**: 権限なしユーザーで`action: "admin"`
- **期待される結果**: 403 Forbiddenページの表示
- **エラーメッセージ**: "このアクションを実行する権限がありません"
- **テストの目的**: アクセス制御の確認

### 無効なtreeId/nodeId
- **テスト名**: 存在しないリソースIDのエラーハンドリング
- **入力値**: `treeId: "invalid-999"`
- **期待される結果**: エラーバウンダリによる適切なエラー表示
- **エラーメッセージ**: "指定されたツリーが見つかりません"
- **テストの目的**: データ不整合時の安全な処理

## 3. 境界値テストケース

### 最小パスパラメータ
- **テスト名**: treeIdのみの最小URLパターン
- **入力値**: `/t/tree-123`
- **期待される結果**: 
  ```typescript
  {
    treeId: "tree-123",
    pageTreeNodeId: undefined,
    targetTreeNodeId: undefined,
    treeNodeType: undefined,
    action: undefined
  }
  ```
- **テストの目的**: 最小構成での動作確認

### 最大パスパラメータ
- **テスト名**: 全パラメータ+クエリパラメータの最大URLパターン
- **入力値**: `/t/tree-123/node-456/node-789/shapes/batch?step=3&filter=active`
- **期待される結果**: すべてのパラメータとクエリが正しく解析される
- **テストの目的**: 最大構成での動作確認

### 空文字列・nullパラメータ
- **テスト名**: 空文字列パラメータの処理
- **入力値**: `/t//node-456`（空のtreeId）
- **期待される結果**: 404エラーまたはリダイレクト
- **テストの目的**: 無効入力の処理確認

## テスト実装環境

- **プログラミング言語**: TypeScript
- **テストフレームワーク**: Vitest + React Testing Library
- **テスト実行環境**: Node.js環境でのDOM仮想化、ブラウザ環境でのE2Eテスト

## テストケース実装時の方針

### Given-When-Thenパターン
```typescript
describe('階層的URLルーティング', () => {
  it('階層的URLパラメータを正常に解析する', async () => {
    // Given: テストデータとルート設定
    const testUrl = '/t/tree-123/node-456/node-789/basemap/edit';
    
    // When: ルートにナビゲート
    const { params } = await navigateTo(testUrl);
    
    // Then: パラメータが正しく解析される
    expect(params.treeId).toBe('tree-123');
    expect(params.pageTreeNodeId).toBe('node-456');
    expect(params.targetTreeNodeId).toBe('node-789');
    expect(params.treeNodeType).toBe('basemap');
    expect(params.action).toBe('edit');
  });
});
```

## カバレッジ目標

- 正常系: 100%
- 異常系: 主要なエラーパターンを網羅
- 境界値: URLパラメータの最小・最大構成をカバー
- 統合テスト: ルーティング→データロード→レンダリングの一連の流れ