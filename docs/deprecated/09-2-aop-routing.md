## 9.2 プラグインとルーティング

本章では、ツリーノードの `treeNodeType` によって切り替わる「プラグインUI」の仕組みを、現状のルーティング実装と AOP ベースのプラグイン設計を踏まえて説明する。8章で述べた階層的URLパターンに適合し、プラグインごとのアクション（view/edit/batch など）を動的にレンダリングできる。

- 対象コード（抜粋）
  - `packages/app/app/routes/t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).tsx`
  - `packages/app/app/routes/t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx`
  - (URL/Loader Data/レイアウト）
  - NodeTypeRegistry / UnifiedPluginDefinition / UI拡張

### 9.2.1 URL と ファイルルートの対応

- 外部仕様 
  - `/t/:treeId/:pageTreeNodeId?/:targetTreeNodeId?/:treeNodeType?/:action?`
- 実装上のファイルルート
  - `t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).tsx`
  - `t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx`
- 各ファイルで `clientLoader` を定義し、段階的にデータをロード
  - `loadTreeNodeType`, `loadTreeNodeAction`（`~/loader` 経由、詳細はアプリ側実装）

これにより、URL の各セグメント追加に応じて必要なデータだけがロードされ、UI は `<Outlet/>` で下位に受け渡す。

### 9.2.2 画面の階層と責務

- `/t/:treeId` レベル: ツリー全体のコンテキストを用意
- `/t/:treeId/:pageTreeNodeId` レベル: ページ対象のノード（現在地）を確定
- `/t/:treeId/:pageTreeNodeId/:targetTreeNodeId` レベル: 操作対象ノードを確定
- `/t/:treeId/.../:treeNodeType` レベル: プラグインUI（ノードタイプ別）を表示
- `/t/:treeId/.../:treeNodeType/:action` レベル: プラグイン内アクションを表示

各レベルの `clientLoader` が統合データを構築し、下位はそれを `useLoaderData()` から参照する。`_layout.tsx` ファイルを適宜設置し、共通UI（パンくず、サイドバー、エラーバウンダリ）を提供する。

### 9.2.3 Plugin UI のデータ契約

8章 8.3.2 の LoaderData 例（要約）:

```ts
interface LoaderData {
  treeContext: {
    tree: Tree;
    currentNode: TreeNode | null;
    breadcrumbs: BreadcrumbItem[];
    expandedNodes: Set<TreeNodeId>;
  };
  targetNode: TreeNode | null;
}
```

プラグインUIは最低限 `tree`, `pageTreeNode`, `targetTreeNode`, `treeNodeType`, `action` を参照して画面を切り替える。追加の `pluginData` はプラグイン固有 loader あるいは Worker API 拡張で供給される想定。

### 9.2.4 エラーハンドリングとフォールバック

- 未登録の `treeNodeType`:
  - 「未サポートノードタイプ」用のデフォルト画面を表示
- 未登録の `action`:
  - `defaultAction` があればそれを使用、なければ一覧を提示してユーザー選択
- Loader 失敗時:
  - 上位 `_layout.tsx` の ErrorBoundary でメッセージ表示・再試行導線

### 9.2.5 権限・認証との連携

- 9章の `RequireAuth` により `/t/...` 配下を保護
- プラグイン側は、`useBFFAuth().getIdToken()` を用いて CORS Proxy/BFF 経由で保護APIを呼ぶことが可能
- プラグインごとの権限（ロール/スコープ）チェックは UnifiedPluginDefinition のメタデータや UI レベルで実装拡張

### 9.2.6 パフォーマンスと分割

- `lazy()` によるコード分割で初回表示を軽量化
- `clientLoader` の段階的取得で N+1 を避け、上位で共通データをキャッシュ
- `working copy`（5章）を活用して編集中の負荷を抑制

### 9.2.7 既存の t.* ルート（現状コードの読み解き）

- `t.($treeId).tsx`: `loadTree` によりツリー情報を取得し、`<Outlet/>` に渡す
- `t.($treeId).($pageTreeNodeId).tsx`: `loadPageTreeNode`
- `t.($treeId).($pageTreeNodeId).($targetTreeNodeId).tsx`: `loadTargetTreeNode`
- `t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).tsx`: `loadTreeNodeType`（treeNodeType確定）
- `t.($treeId).($pageTreeNodeId).($targetTreeNodeId).($treeNodeType).($action).tsx`: `loadTreeNodeAction`（action確定）

現在は各ファイルで `useLoaderData()` の値をダンプ表示しており、これを Registry 連携による動的コンポーネント描画に差し替えるのが次段階の実装指針となる。

### 9.2.8 まとめ

- `treeNodeType` と `action` に応じてプラグインUIを動的に描画する設計
- NodeTypeRegistry（7章）とルーティング（8章）を橋渡しし、統一的に拡張
- ベースUI（10章）と認証（9章）を土台に、プラグインごとの体験を積み上げていく

