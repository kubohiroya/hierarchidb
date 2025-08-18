## 6.4 Pub-Sub モデル

UI と Worker の購読契約を明確化し、URL と部分木購読の設計を記述します。

### 6.4.1 動作概要
- UI は URL パス `/t/:treeId/:pageTreeNodeId` を用いて、表示ページの部分木を購読（subscribeSubTree）します。
- 同一ツリーを複数タブで購読可能。別タブでの更新はリアルタイムに反映されます。
- Worker はツリールートごとに expanded 状態を永続化し、開状態の枝の差分を購読者へ配信します。
- ノード更新のたびに、更新ノードが購読 `pageNodeId` の直系先祖かを判定し、該当時に配信します。

### 6.4.2 Worker exposed interface（抜粋）

```ts
// Worker exposed interface
export interface TreeObservableService {

  // ---- subscription ----
  subscribeSubTree(
    pageTreeNodeId: TreeNodeId,
    notifyExpandedChangesCallback: (changes: ExpandedStateChanges) => void,
    notifySubTreeChangesCallback: (changes: SubTreeChanges) => void
  ): Promise<{
    initialSubTree: Promise<SubTreeChanges>,
    unsubscribeSubTree: ()=>void
  }>;

  toggleNodeExpanded(pageTreeNodeId: TreeNodeId): Promise<void>;
  
  // ---- query ----
  listChildren(parentId: TreeNodeId, doExpandNode?: boolean): Promise<SubTreeChanges>; // ソート: name ASC（正規化済み）
  getAncestors(pageNodeId: TreeNodeId): Promise<TreeNode[]>;
  searchByNameWithDepth(rootNodeId: TreeNodeId, query: string, opts: {
    maxDepth: number; maxVisited?: number;
  }): Promise<TreeNode[]>;
  
  // (略)
}
```

## 6.4.3 差分配信と購読の要点
- expanded の管理と差分合成（ExpandedStateChanges／SubTreeChanges）。
- 表示側は差分のマージにより UI 状態を更新。
- 検索・祖先列挙などの query API との併用方針。

### 6.4.4 契約詳細（重要事項）
- 初期スナップショット: subscribeSubTree は { initialSubTree, unsubscribeSubTree } を返す。initialSubTree は購読登録後に取得され、同一 pageNodeId ストリーム上で version 整合が保たれる。
  - UI は initialSubTree を適用後、以降の SubTreeChanges/ExpandedStateChanges を version 順に適用する。
- バージョン整合性: ExpandedStateChanges.version と SubTreeChanges.version は、同一 treeId+treeRootNodeType のストリームで単調増加とする。
  - 古い version の差分は破棄（idempotent マージを前提）。
- 配信順序: 同一ストリームでは送出順 = version 順を保証。異なるページ/ルート間の順序は未定義。
- マージ規則の再掲:
  - ExpandedState: changes を expanded にマージ。boolean true は「全開」を意味。Record では値 null が削除を示す。
  - SubTree: changes を UI 状態へキー単位でマージ。値 null はノード削除。
- 多重購読: 同一 pageNodeId への重複購読は避けること。必要時は上位でデバウンス/共有（multicast）する。
- 解除: unsubscribeSubTree は冪等。複数回呼んでも安全。

### 6.4.5 エラー・切断・再接続
- コールバック例外は Worker 内で捕捉され、購読自体は継続される（ログ出力のみ）。
- 通信断や Worker 再起動時:
  - 自動的に再購読を試み、最新 initialSubTree を再送する。
  - UI は古い version の差分を破棄し、再送された initialSubTree から再構築する。
- エラー分類（例）:
  - E_SUBTREE_NOT_FOUND: pageNodeId が存在しない。
  - E_PERMISSION: アクセス不可（将来の認可導入時）。
  - E_BACKPRESSURE: 内部キュー逼迫時に一時的に初期化し直す要求。

### 6.4.6 パフォーマンス指針
- 差分の同期間引き: マイクロタスク境界で coalesce（高頻度更新時にまとめて1回配信）。
- スロットリング目安: UI への通知はおおむね 60Hz 以下を目安にする。
- listChildren ソート: name（正規化済み）昇順。大量子数時はページングの導入を検討（今後拡張）。
- searchByNameWithDepth: opts.maxVisited の既定値を実装側で制限（例: 10_000）し、打ち切り時は部分結果を返す。

### 6.4.7 制約と非目標
- セッション/タブ: 同一ツリーの複数タブ間で更新は即時伝搬するが、タブ間の UI 状態（選択/スクロール等）は共有しない。
- セキュリティ: 本ドキュメントではローカル Worker 前提。認可・認証は別章で規定（未導入環境では全許可）。
- 一貫性モデル: 単一端末内では強い順序づけ（同一ストリームの順序保証）。分散環境でのグローバル順序は対象外。
