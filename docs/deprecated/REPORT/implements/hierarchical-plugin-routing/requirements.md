# 階層的URLパターンでのプラグインルーティングシステム要件定義

## 1. 機能の概要

### 主要機能
- 階層的URLパターン `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?` を維持したルーティングシステム
- `treeNodeType` パラメータによるプラグインの動的ロード
- file-convention based route config (@react-router/fs-routes) の活用
- useLoaderData による階層情報とプラグインデータの統合

### 解決する問題
- 既存の階層ナビゲーション構造を保持しながらプラグイン拡張を可能にする
- URLから現在位置と操作対象が明確に分かる
- ブラウザの履歴管理と自然に統合

### システム内での位置づけ
- React Router v7のfile-based routing機能を活用
- 既存のeria-cartographパターンをhierarchidbに適用

## 2. 入力・出力の仕様

### URLパラメータ仕様
```typescript
interface RouteParams {
  treeId: string;              // Tree識別子
  pageTreeNodeId?: string;     // 現在表示中のノード
  targetTreeNodeId?: string;   // 操作対象のノード
  treeNodeType?: string;        // プラグイン識別子（basemap, shapes等）
  action?: string;              // プラグイン内アクション（edit, preview等）
}

interface QueryParams {
  step?: string;                // ウィザードステップ等
  [key: string]: string | undefined;
}
```

### LoaderData仕様
```typescript
interface LoaderData {
  treeContext: {
    tree: Tree;
    currentNode: TreeNode | null;
    breadcrumbs: BreadcrumbItem[];
    expandedNodes: Set<TreeNodeId>;
  };
  targetNode: TreeNode | null;
  pluginData: unknown;  // プラグイン固有のデータ
  permissions: string[];
}
```

### プラグイン設定仕様
```typescript
interface PluginRouteConfig {
  pluginId: string;              // プラグイン識別子
  nodeType: TreeNodeType;         // 対応するノードタイプ
  actions: {
    [actionName: string]: {
      component: React.ComponentType;
      loader?: LoaderFunction;
      action?: ActionFunction;
      permissions?: string[];
    };
  };
}
```

## 3. 制約条件

### パフォーマンス要件
- プラグインコンポーネントの遅延ロード（Code Splitting）
- ルート解決時間 < 100ms
- 初回ロード時間 < 3秒

### 互換性要件
- React Router v7対応
- 既存のeria-cartograph URLパターンとの互換性維持
- ブラウザの戻る/進むボタンの自然な動作

### アーキテクチャ制約
- file-convention based routing（@react-router/fs-routes）の使用
- Viteビルドシステムとの統合
- TypeScript型安全性の確保

## 4. 想定される使用例

### 基本的な使用パターン
```
// BasemapプラグインのEdit画面
/t/tree-123/node-456/node-789/basemap/edit

// Shapesプラグインのバッチ処理
/t/tree-123/node-456/node-789/shapes/batch?step=2

// プラグインなし（通常のツリー表示）
/t/tree-123/node-456
```

### エッジケース
- 存在しないプラグインタイプへのアクセス → 404表示
- 権限のないアクションへのアクセス → 403表示
- 無効なtreeId/nodeId → エラーバウンダリで処理

### データフロー
1. ブラウザがURLにアクセス
2. React Routerがパラメータを抽出
3. Loaderが階層情報を取得
4. プラグイン固有のデータをロード
5. コンポーネントをレンダリング

## 5. 実装ファイル構造

```
packages/app/src/routes/
├── t/
│   ├── $treeId/
│   │   ├── _layout.tsx                 # ツリーレイアウト
│   │   ├── index.tsx                   # ツリールート
│   │   ├── $pageTreeNodeId/
│   │   │   ├── index.tsx               # ノード表示
│   │   │   ├── $targetTreeNodeId/
│   │   │   │   ├── index.tsx           # ターゲットノード
│   │   │   │   └── $treeNodeType/
│   │   │   │       ├── _layout.tsx     # プラグインレイアウト
│   │   │   │       └── $.tsx           # 動的アクションルート
```

## 6. 受け入れ基準

- [ ] 階層的URLパターンが正しく動作する
- [ ] プラグインが動的にロードされる
- [ ] useLoaderDataで階層情報が取得できる
- [ ] ブラウザの履歴が正しく動作する
- [ ] TypeScript型が正しく推論される
- [ ] 存在しないルートで404が表示される
- [ ] 権限チェックが動作する