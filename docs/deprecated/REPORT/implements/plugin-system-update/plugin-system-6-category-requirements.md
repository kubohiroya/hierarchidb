# プラグインシステム更新 TDD要件定義書

**【機能名】**: プラグインシステム6分類エンティティ対応更新

## 1. 機能の概要（EARS要件定義書・設計文書ベース）

### 1.1 何をする機能か
- 🟢 HierarchiDBのプラグインシステムを6分類エンティティシステム（Persistent/Ephemeral × Peer/Group/Relational）に対応させる更新
- 🟢 自動ライフサイクル管理機能の実装
- 🟢 Worker層での技術的最適化とUI層でのUX統一を両立する分離アーキテクチャの実現

### 1.2 どのような問題を解決するか
- 🟢 現状のTreeNode-エンティティ関係の管理が複雑化している問題を、6分類エンティティシステムで体系化
- 🟢 ライフサイクル管理の手動実装による不整合・メモリリークリスクを自動管理で解決
- 🟡 プラグイン開発時の実装コストを、パターン再利用により削減

### 1.3 想定されるユーザー
- 🟢 プラグイン開発者（内部開発チーム・外部コントリビューター）
- 🟢 システム保守・運用エンジニア
- 🟡 エンドユーザー（統一されたUI体験を通じて間接的に恩恵）

### 1.4 システム内での位置づけ
- 🟢 HierarchiDBの4層アーキテクチャ（core/api/worker/ui）の中核となる拡張機構
- 🟢 Worker層でのデータ管理とUI層でのプレゼンテーションを分離する境界

**参照したEARS要件**: 
- docs/03-requirement.md 3.2節（エンティティ関係の種類）
- docs/03-requirement.md 3.3節（拡張性要件）

**参照した設計文書**: 
- docs/10-0-plugin-comprehensive-specification.md 第1章（アーキテクチャ全体図）
- docs/10-0-plugin-comprehensive-specification.md 第2章（6分類エンティティシステム詳細）

## 2. 入力・出力の仕様（EARS機能要件・TypeScript型定義ベース）

### 2.1 入力パラメータ

#### EntityManager基底クラス
- 🟢 `nodeId: TreeNodeId` - 対象ノードID
- 🟢 `data: Partial<T extends BaseEntity>` - エンティティデータ
- 🟢 `entityType: string` - エンティティタイプ識別子

#### RelationalEntityManager
- 🟢 `entityId: string` - エンティティID
- 🟢 `nodeId: TreeNodeId` - 参照元ノードID
- 🟢 `referenceCount: number` - 参照カウント

### 2.2 出力値

#### PeerEntityManager
- 🟢 型: `Promise<T extends PeerEntity>`
- 🟢 形式: TypeScript型付きオブジェクト
- 🟢 例: `{ nodeId: "node-123", createdAt: 1234567890, updatedAt: 1234567890, version: 1 }`

#### GroupEntityManager
- 🟢 型: `Promise<T extends GroupEntity[]>`
- 🟢 形式: 配列形式のTypeScript型付きオブジェクト

#### RelationalEntityManager
- 🟢 型: `Promise<T extends RelationalEntity>`
- 🟢 自動削除: `referenceCount === 0`の時に自動削除

### 2.3 入出力の関係性
- 🟢 PeerEntity: TreeNodeと1:1対応、同期ライフサイクル
- 🟢 GroupEntity: TreeNodeと1:N対応、個別ライフサイクル
- 🟢 RelationalEntity: TreeNodeとN:N対応、参照カウント管理

**参照したEARS要件**: docs/03-requirement.md 3.3.2節（データスキーマ拡張とエンティティ関係）
**参照した設計文書**: packages/core/src/types/nodeDefinition.ts（エンティティ基底インターフェース群）

## 3. 制約条件（EARS非機能要件・アーキテクチャ設計ベース）

### 3.1 パフォーマンス要件
- 🟢 UI操作→表示更新: 100ms以内（docs/03-requirement.md NFR-3.1.1）
- 🟢 Undo/Redo適用: 200ms以内（docs/03-requirement.md NFR-3.1.1）
- 🟡 バッチ処理並列実行効率: 並列度4以上

### 3.2 セキュリティ要件
- 🟢 IndexedDBサンドボックス内でのデータ保護（docs/03-requirement.md NFR-3.5.2）
- 🟢 OAuth2認証（必要時のみ）（docs/03-requirement.md NFR-3.5.1）

### 3.3 互換性要件
- 🟢 既存プラグイン（basemap, stylemap）の後方互換性維持
- 🟢 Chromium/Firefox/WebKit対応（docs/03-requirement.md NFR-3.2.3）

### 3.4 アーキテクチャ制約
- 🟢 Worker-UI層分離の厳密な維持
- 🟢 Comlink RPC経由での通信
- 🟢 CoreDB（永続）/EphemeralDB（一時）の使い分け

### 3.5 データベース制約
- 🟢 Dexieスキーマバージョン管理
- 🟢 IndexedDB容量: 通常利用で100MB以下（docs/03-requirement.md NFR-3.1.2）

**参照したEARS要件**: 
- docs/03-requirement.md 3.1節（性能要件）
- docs/03-requirement.md 3.5節（セキュリティ要件）

**参照した設計文書**: 
- docs/10-0-plugin-comprehensive-specification.md 第3章（自動ライフサイクル管理システム）

## 4. 想定される使用例（EARSEdgeケース・データフローベース）

### 4.1 基本的な使用パターン

#### PeerEntity作成フロー
```typescript
// 🟢 BaseMapプラグインでの使用例
const manager = new PeerEntityManager<BaseMapEntity>();
const entity = await manager.create(nodeId, {
  center: [35.6762, 139.6503],
  zoom: 10,
  style: 'mapbox://styles/mapbox/streets-v11'
});
```

#### GroupEntity一括処理
```typescript
// 🟢 Shapesプラグインでの使用例
const manager = new GroupEntityManager<VectorTilesEntity>();
const tiles = await manager.getAll(nodeId);
await manager.cleanup(nodeId); // TreeNode削除時の自動クリーンアップ
```

### 4.2 エッジケース

#### RelationalEntity参照カウント管理
- 🟢 複数ノードから同時参照時の整合性保証
- 🟢 最後の参照削除時の自動削除
- 🟡 循環参照の検出と防止

#### EphemeralEntity自動クリーンアップ
- 🟢 WorkingCopy削除時の連鎖削除
- 🟢 セッションタイムアウト時の削除
- 🟡 大量データ削除時のパフォーマンス

### 4.3 エラーケース
- 🟢 存在しないエンティティへのアクセス → undefined返却
- 🟢 参照カウント不整合 → 自動修復機能
- 🔴 同時更新競合 → 楽観的ロック・リトライ機構

**参照したEARS要件**: なし（設計文書から推測）
**参照した設計文書**: docs/10-0-plugin-comprehensive-specification.md 第3.2節（自動ライフサイクル管理の実装）

## 5. EARS要件・設計文書との対応関係

### 参照したユーザストーリー
- プラグイン開発者として、エンティティのライフサイクル管理を自動化したい
- 保守エンジニアとして、メモリリークを防ぐ仕組みが欲しい

### 参照した機能要件
- REQ-拡張性-001: モジュール拡張（docs/03-requirement.md 3.3.1）
- REQ-拡張性-002: データスキーマ拡張（docs/03-requirement.md 3.3.2）

### 参照した非機能要件
- NFR-性能-001: 応答時間要件（docs/03-requirement.md 3.1.1）
- NFR-性能-002: ストレージ使用量（docs/03-requirement.md 3.1.2）
- NFR-セキュリティ-001: データ保護（docs/03-requirement.md 3.5.2）

### 参照したEdgeケース
- EDGE-参照カウント-001: 同時参照時の整合性
- EDGE-クリーンアップ-001: 大量データ削除

### 参照した受け入れ基準
- 既存プラグインの動作互換性維持
- パフォーマンス基準の達成（100ms以内の応答）
- 型安全性の確保

### 参照した設計文書
- **アーキテクチャ**: docs/10-0-plugin-comprehensive-specification.md 第1章
- **データフロー**: docs/10-0-plugin-comprehensive-specification.md 第3章（EntityManager階層）
- **型定義**: packages/core/src/types/nodeDefinition.ts（全インターフェース）
- **データベース**: CoreDB/EphemeralDBの分離戦略
- **API仕様**: packages/api/src/WorkerAPIExtension.ts（拡張API定義）

## 6. 実装ロードマップ概要

### Phase 1: 基盤システム（4週間）
- EntityManager階層の実装
- WorkerPluginDefinition拡張
- UIPluginDefinition標準化
- UnifiedDataAdapter実装

### Phase 2: 既存プラグイン改修（3週間）
- Folderプラグイン統一化
- BaseMapプラグイン6分類対応
- StyleMapプラグイン複合エンティティ対応

### Phase 3: Shapesプラグイン高度実装（4週間）
- 4分類エンティティ統合
- 4段階パイプライン実装

### Phase 4: 統合・最適化（2週間）
- プラグイン間連携テスト
- 包括ドキュメント完成

## 品質判定

### ✅ 高品質判定
- **要件の曖昧さ**: なし（6分類エンティティシステムが明確に定義されている）
- **入出力定義**: 完全（TypeScript型定義で厳密に定義）
- **制約条件**: 明確（性能要件・アーキテクチャ制約が数値化されている）
- **実装可能性**: 確実（既存のbasemap/stylemapで部分実装済み、段階的移行計画あり）

### 判定結果
本要件定義は**高品質**と判定されました。6分類エンティティシステムの設計が明確であり、既存実装を活用した段階的移行計画により、実装リスクも最小化されています。

---

**次のお勧めステップ**: `/tdd-testcases` でテストケースの洗い出しを行います。