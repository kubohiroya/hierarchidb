# Working Copy Migration Plan

## 概要
このドキュメントは、`docs/X-dialog.md`の仕様に基づいて、ワーキングコピーシステムを移行するための計画を記述します。

## 主要な変更点

### 1. ワーキングコピーの定義の明確化
**変更前**: ワーキングコピーはTreeNodeとEntityが混在した曖昧な構造
**変更後**: ワーキングコピーは明確に以下の2つの要素から構成される：
- TreeNodeのワーキングコピー（別のTreeNodeとして存在）
- Entityのコピーオンライト管理

### 2. ID管理の分離
**変更前**: 
- workingCopyIdが独自に存在
- TreeNodeとEntityで同じIDを使用

**変更後**:
- ワーキングコピーのTreeNodeは独自のtreeNodeIdを持つ
- workingCopyOfプロパティでオリジナルのTreeNodeIdを参照
- 新規作成時: workingCopyOf = 自身のID
- 編集時: workingCopyOf = オリジナルのID

### 3. Entity管理のコピーオンライト化
**変更前**: ワーキングコピー作成時にEntityも即座にコピー
**変更後**: 
- PeerPersistentEntity: 編集時のみコピー
- PersistentGroupEntity: 編集時のみコピー
- PersistentRelationEntity: 編集時のみコピー

## 実装計画

### Phase 1: インターフェースの更新
1. `packages/core/src/types/workingCopy.ts`の更新
   - WorkingCopyをTreeNodeを継承する形に変更
   - workingCopyIdの削除

2. `packages/core/src/types/tree.ts`の確認
   - WorkingCopyPropertiesが正しく定義されていることを確認

### Phase 2: TreeNodeワーキングコピー処理の実装
1. `packages/worker/src/operations/WorkingCopyOperations.ts`の更新
   - createWorkingCopyFromNode: TreeNodeのコピーとして作成
   - 独自のtreeNodeIdを採番
   - workingCopyOfにオリジナルのIDをセット

2. データベース保存先の分離
   - ワーキングコピーのTreeNode: EphemeralDB
   - オリジナルのTreeNode: CoreDB

### Phase 3: Entityのコピーオンライト実装
1. `packages/worker/src/handlers/EntityHandler.ts`の更新
   - createWorkingCopy: TreeNodeのみコピー、Entityはコピーしない
   - updateWorkingCopy: 初回更新時にEntityをコピー
   - commitWorkingCopy: Entity IDの繋ぎ直し処理

2. Entity管理フラグの追加
   - hasEntityCopy: Entityがコピー済みかどうか
   - entityCopyId: コピーされたEntityのID（元のIDと異なる）

### Phase 4: ライフサイクル管理の更新
1. コミット処理
   - ワーキングコピーのTreeNode内容をオリジナルに反映
   - EntityのIDをオリジナルのTreeNodeIdに繋ぎ直し
   - オリジナルのEntityを削除
   - ワーキングコピーを破棄

2. 破棄処理
   - ワーキングコピーのTreeNodeを削除
   - コピーされたEntityがあれば削除

3. ドラフト保存
   - isDraftフラグをtrueにセット
   - 通常のコミット処理と同様だがisDraftを維持

### Phase 5: テストと検証
1. 単体テストの更新
   - WorkingCopyOperations.test.ts
   - EntityHandler.test.ts
   - WorkingCopyHandler.test.ts

2. 統合テストの作成
   - TreeNodeとEntityの連携
   - コピーオンライトの動作確認
   - ID管理の整合性確認

## 影響範囲

### 影響を受けるパッケージ
- packages/core
- packages/worker
- packages/api
- packages/ui-client

### 影響を受けるプラグイン
- packages/plugins/basemap
- packages/plugins/stylemap
- packages/plugins/shape

## リスクと対策

### リスク1: 既存データとの互換性
**対策**: マイグレーション処理を実装し、既存のワーキングコピーを新形式に変換

### リスク2: パフォーマンスへの影響
**対策**: コピーオンライトによりメモリ使用量は削減されるが、初回編集時のレイテンシを監視

### リスク3: UI層への影響
**対策**: APIインターフェースは維持し、内部実装のみ変更

## スケジュール見積もり
- Phase 1: 2時間
- Phase 2: 4時間
- Phase 3: 6時間
- Phase 4: 4時間
- Phase 5: 4時間
- 合計: 20時間

## 成功基準
1. ワーキングコピーがTreeNodeとして正しく作成される
2. Entityがコピーオンライトで管理される
3. コミット時にIDが正しく繋ぎ直される
4. 既存のテストがすべてパスする
5. パフォーマンスが劣化しない