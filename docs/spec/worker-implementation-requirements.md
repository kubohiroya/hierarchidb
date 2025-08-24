# Worker実装 要件定義書

## 概要

本書は、hierarchidbのWorker層実装に関する要件定義書である。Worker層は、UI層からのコマンドを受け付け、CoreDB/EphemeralDBを更新し、購読者への差分通知を行うバックエンド的役割を担う。AOP（アスペクト指向プログラミング）アーキテクチャにより、ノードタイプごとの振る舞いを拡張可能にする。

## 関連文書

- **ユーザストーリー**: [📖 worker-implementation-user-stories.md](worker-implementation-user-stories.md)
- **受け入れ基準**: [✅ worker-implementation-acceptance-criteria.md](worker-implementation-acceptance-criteria.md)
- **AOPアーキテクチャ**: [🔧 aop-plugin-architecture-requirements.md](aop-plugin-architecture-requirements.md)
- **設計文書**: [📐 ../7-aop-architecture.md](../7-aop-architecture.md)

## 機能要件（EARS記法）

### 通常要件

🟢 **データベース管理**
- REQ-001: システムは CoreDB（長命データ）と EphemeralDB（短命データ）の2つのIndexedDBインスタンスを管理しなければならない
- REQ-002: システムは Dexieを使用してIndexedDBへのアクセスを抽象化しなければならない
- REQ-003: システムは データベーススキーマのバージョン管理とマイグレーションをサポートしなければならない

🟢 **ノードタイプレジストリ**
- REQ-004: システムは NodeTypeRegistryを通じてノードタイプ定義を動的に登録・管理しなければならない
- REQ-005: システムは 各ノードタイプにEntityHandlerを関連付けなければならない
- REQ-006: システムは ノードタイプごとのデータベーススキーマを動的に適用しなければならない

🟢 **コマンド処理**
- REQ-007: システムは UI層からのコマンドを順序付けて処理しなければならない
- REQ-008: システムは 各コマンドにグローバル一意のseq番号を採番しなければならない
- REQ-009: システムは コマンドの成功/失敗結果をUI層に返却しなければならない

🟢 **ライフサイクル管理**
- REQ-010: システムは NodeLifecycleManagerを通じてノードのライフサイクルフックを実行しなければならない
- REQ-011: システムは ノード作成/更新/削除の前後でフックを実行しなければならない
- REQ-012: システムは フックの実行順序を保証しなければならない

🟢 **購読管理**
- REQ-007: システムは TreeNodeの購読開始/終了を管理しなければならない
- REQ-008: システムは 購読中のノードに変更があった場合、差分のみを通知しなければならない
- REQ-009: システムは 16msのコアレスで差分通知をバッチ処理しなければならない

### 条件付き要件

🟢 **Working Copy管理**
- REQ-101: 新規作成の場合、システムは createWorkingCopyForCreateコマンドで一時データを作成しなければならない
- REQ-102: 既存ノード編集の場合、システムは createWorkingCopyコマンドでシャローコピーを作成しなければならない
- REQ-103: コミット時、システムは 楽観的ロックでバージョン競合を検出しなければならない

🟢 **名前競合処理**
- REQ-104: onNameConflictが'error'の場合、システムは 兄弟名の重複時にエラーを返却しなければならない
- REQ-105: onNameConflictが'auto-rename'の場合、システムは 自動的に名前に番号を付与しなければならない

🟢 **Undo/Redo管理**
- REQ-106: Undoコマンドを受信した場合、システムは 逆操作を新規コマンドとして実行しなければならない
- REQ-107: Redoコマンドを受信した場合、システムは 元の操作を再実行しなければならない

### 状態要件

🟢 **ツリー展開状態**
- REQ-201: TreeRootStateのexpandedがtrueの場合、システムは すべてのノードを展開状態として扱わなければならない
- REQ-202: TreeRootStateのexpandedがRecordの場合、システムは 指定されたノードのみを展開状態として扱わなければならない

🟡 **ゴミ箱管理**
- REQ-203: ノードがTrashRoot配下にある場合、システムは originalParentTreeNodeIdを保持しなければならない
- REQ-204: ノードがTrashRoot配下にある場合、システムは removedAtタイムスタンプを設定しなければならない

### オプション要件

🟡 **パフォーマンス最適化**
- REQ-301: システムは 頻繁にアクセスされるデータをメモリにキャッシュしてもよい
- REQ-302: システムは 大量の差分通知を圧縮して送信してもよい

### 制約要件

🟢 **データ整合性**
- REQ-401: システムは 同一parentTreeNodeId配下でnameの一意性を保証しなければならない
- REQ-402: システムは 自己参照・循環参照を防止しなければならない
- REQ-403: システムは クロスツリー間の親子関係を禁止しなければならない

🟢 **リソース制限**
- REQ-404: システムは Undo/Redoバッファを200コマンドまでに制限しなければならない
- REQ-405: システムは 古いコマンド履歴から自動的に破棄しなければならない

## 非機能要件

### パフォーマンス

🟢 **応答時間**
- NFR-001: コマンド処理は100ms以内に完了すること
- NFR-002: 差分検出と通知は50ms以内に完了すること
- NFR-003: データベース検索は10万ノードでも200ms以内に完了すること

### セキュリティ

🟡 **データ保護**
- NFR-101: Worker内のデータはブラウザのサンドボックス内で保護されること
- NFR-102: 機密情報はCoreDB/EphemeralDBに格納しないこと

### ユーザビリティ

🟡 **エラーメッセージ**
- NFR-201: エラーコードと詳細メッセージを含む構造化エラーを返却すること
- NFR-202: NAME_NOT_UNIQUE, STALE_VERSION, HAS_INBOUND_REFS, ILLEGAL_RELATIONなどの定義済みエラーコードを使用すること

## アーキテクチャ設計（7-aop-architecture.mdより）

### ノードタイプ定義システム

🟢 **NodeTypeDefinition構造**
```typescript
interface NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  nodeType: TreeNodeType;
  name: string;
  displayName: string;
  database: {
    entityStore: string;
    subEntityStores?: string[];
    schema: DatabaseSchema;
  };
  entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
  lifecycle: NodeLifecycleHooks<TEntity>;
  ui?: { /* UI設定 */ };
  api?: { /* API拡張 */ };
  validation?: { /* バリデーション */ };
}
```

### EntityHandler実装要件

🟢 **必須メソッド**
- `createEntity()`: エンティティの新規作成
- `getEntity()`: エンティティの取得
- `updateEntity()`: エンティティの更新
- `deleteEntity()`: エンティティの削除
- `createWorkingCopy()`: ワーキングコピー作成
- `commitWorkingCopy()`: ワーキングコピーのコミット
- `discardWorkingCopy()`: ワーキングコピーの破棄

🟡 **オプションメソッド**
- `createSubEntity()`: サブエンティティ作成
- `getSubEntities()`: サブエンティティ取得
- `duplicate()`: 複製処理
- `backup()`: バックアップ
- `restore()`: リストア

### NodeLifecycleManager実装

🟢 **ライフサイクル処理フロー**
1. `handleNodeCreation()`: beforeCreate → コア処理 → エンティティ作成 → afterCreate
2. `handleNodeUpdate()`: beforeUpdate → コア処理 → エンティティ更新 → afterUpdate
3. `handleNodeDeletion()`: beforeDelete → エンティティ削除 → コア処理 → afterDelete

## Edgeケース

### エラー処理

🟡 **データベースエラー**
- EDGE-001: IndexedDBの容量制限に達した場合、適切なエラーメッセージを返却する
- EDGE-002: データベース接続が失敗した場合、再接続を試みる

🟡 **競合処理**
- EDGE-101: 同時に複数のコマンドが同一ノードを更新しようとした場合、楽観的ロックで後発を拒否する
- EDGE-102: 削除済みノードへの操作が発生した場合、エラーを返却する

🟢 **ライフサイクルエラー**
- EDGE-103: ライフサイクルフックが例外を投げた場合、エラーログを記録して処理を中断する
- EDGE-104: EntityHandlerが未定義の場合、コア処理のみを実行する

### 境界値

🔴 **大規模データ**
- EDGE-201: 10万ノードを超えるツリーでも性能劣化しないこと
- EDGE-202: 1000件の同時購読でも通知遅延が発生しないこと