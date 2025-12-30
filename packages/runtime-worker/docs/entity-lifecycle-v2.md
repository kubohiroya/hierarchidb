vk:doc kind=design audience=dev scope=worker

# Entity Lifecycle V2（統一管理・コマンド統合・Tx/バルク対応）

目的
- TreeNode に 1:1 で対応する「PeerEntity」、1:N の「GroupEntity」、N:N の「RelationalEntity」を、通常/ワーキングコピー/ゴミ箱の状態を問わず、一貫したルールで管理する。
- Ephemeral 複製は廃止し、CoreDB の永続テーブルで統一。CommandProcessor のコマンド境界 Tx とバルク処理に統合する。

基本方針
- 1ノード=1エンティティ原則: 同じ NodeId に対し同一種別の Entity は常に1つ。
- 単一ストア: Ephemeral ではなく CoreDB の永続テーブルに保存（WC/Trash/通常の区別は TreeNode の位置で解釈）。
- 責務分離: name/description 等の表示系は TreeNode。Peer/Group/Relational はドメインデータのみを保持。
- 同一Tx: TreeNode 操作と Entity 操作は常に同一トランザクション内（`WORKER_TX_ENABLED` を有効化した環境では1Txで実行）。
- バルク/チャンク: 大量操作は bulkCreate/bulkUpdate/bulkDelete をチャンク分割で実行。

エンティティ種別
- PeerEntity(1:1): 主キーは NodeId。WC 複製/Commit/Discard を簡潔に表現可能。
- GroupEntity(1:N): 主キー（id）＋ nodeId インデックス、または複合キー。[nodeId+id] の複合ユニーク推奨。
- RelationalEntity(N:N): 主キー [&srcNodeId+type+dstNodeId]。src/dst のインデックス必須。

状態表現（WC/Trash/通常）
- TreeNode が `workingCopyRoot`/`trashRoot`/通常ルート配下にあることで状態を決定。Entity 側に removed/draft フラグは持たない。
- クエリ時に Node の位置から状態を解釈する（例: UI で WC/Trash を切替表示）。

コマンドとの対応（抜粋）
- createNode: 必要なら Peer/Group のデフォルトを生成。
- updateNode: 通常 Entity 変更不要（必要時のみ rename 等）。
- moveNodes: NodeId 不変 → Entity 操作不要。
- moveToTrash/recoverFromTrash: Entity 操作不要（位置で状態解釈）。
- duplicateNodes: NodeId マップを作成し、Peer/Group/Relational をバルク複製（サブツリー内参照のみ複製）。
- pasteNodes: 新 NodeId に対する Entity をバルク作成（クリップボード構造に準拠）。
- importNodes: 2パス（ID割当→実体/関係の適用）。チャンク＋Tx。
- working copy:
  - createWorkingCopy: originalNodeId の Entity を wcNodeId で丸ごと複製（永続）。
  - commitWorkingCopy: wcNodeId 側の Peer/Group を targetNodeId へアップサート。Relational は ID 付け替え。
  - discardWorkingCopy: wcNodeId 側の Entity を削除。

トランザクション/バルク
- CommandProcessor の `processCommand` 内で TreeNode と Entity を同じ `runInTx('rw', ['nodes', ...entityTables])` に束ねる。
- バルクは `PERFORMANCE_CONFIG.BATCH_OPERATION_SIZE` でチャンク分割（既定 50）。

フラグ運用
- 統一 Entity ライフサイクルおよびコマンド境界 Tx / メトリクスは常時有効です。

スキーマ案（CoreDB 例）
```ts
peerEntities: '&nodeId, updatedAt'
features: '&[nodeId+id], nodeId, id, updatedAt'
relations: '&[srcNodeId+type+dstNodeId], srcNodeId, dstNodeId, type, updatedAt'
vectorTiles: '&id, nodeId, [nodeId+z+x+y], timestamp'
```

Handler 構造（最小）
```ts
interface EntityHandler {
  // Peer
  copyPeer(originalId: NodeId, wcId: NodeId): Promise<void>;
  upsertPeer(targetId: NodeId, fromWcId: NodeId): Promise<void>;
  deletePeer(nodeId: NodeId): Promise<void>;

  // Group（必要に応じて）
  copyGroup(originalId: NodeId, wcId: NodeId): Promise<void>;
  upsertGroup(targetId: NodeId, fromWcId: NodeId): Promise<void>;
  deleteGroup(nodeId: NodeId): Promise<void>;

  // Relational（必要に応じて）
  copyRelations(idMap: Map<NodeId, NodeId>): Promise<void>;
  rebindRelations(nodeIdMap: Map<NodeId, NodeId>): Promise<void>;
  deleteRelations(nodeId: NodeId): Promise<void>;
}
```

DoD（段階）
1) PeerEntity: WC create/commit/discard、duplicate、import の Tx/バルク対応、OFF/ON パリティ緑。
2) GroupEntity: 同上＋差分適用アルゴリズム、Import/Export、E2E 追加。
3) RelationalEntity: サブツリー内参照だけ複製、外部参照方針を明記、テスト/E2E。

移行/切替
- Entity ライフサイクル V2 は本番で常時有効化済み。プラグイン側の拡張は段階的に進める。

設計上の決定事項（レビュー確定）
- ID保持方針:
  - Group/Peer の item/node ID は既存資産の ID を保持（重複しない前提の上で Import/Duplicate 時にも原則維持）。
  - 例外的に衝突が発生するケースは Name 同様ポリシーで再採番可能だが、既定は保持。
- Relational の外部参照:
  - 複製/インポート時はサブツリー内参照のみ複製対象。
  - サブツリー外（外部）参照は ID 参照を残すが、解決できない参照はスキップ（集計に計上）。
- Import エラーポリシー:
  - スキップ集計（停止しない）。失敗件数・要因を集計し、結果に含める。
  - 大量エラーでも Tx + Undo/Redo により容易に巻き戻し可能で“怖くない”運用を前提とする。
