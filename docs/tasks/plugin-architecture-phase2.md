# プラグインアーキテクチャ Phase 2: コア機能実装

## フェーズ概要

- **期間**: 4週間（20営業日）
- **目標**: EntityHandlerとライフサイクル管理の完全実装
- **成果物**: 動作するEntityHandler、ライフサイクルマネージャー、Worker API拡張
- **担当**: バックエンド開発主導

## 週次計画

### Week 1: EntityHandler基本実装
- **目標**: CRUD操作の実装
- **成果物**: 基本的なEntityHandler実装

### Week 2: ライフサイクル管理
- **目標**: NodeLifecycleManagerの実装
- **成果物**: フック実行システム

### Week 3: Worker API拡張
- **目標**: プラグイン固有APIの実装
- **成果物**: WorkerAPIRegistry、型安全なAPI

### Week 4: データベース統合
- **目標**: Dexieとの統合
- **成果物**: スキーマ管理、マイグレーション

## 日次タスク

### Week 1: EntityHandler基本実装

#### Day 16 (TASK-0016): BaseEntityHandler抽象クラス

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0005
- **実装詳細**:
  ```typescript
  export abstract class BaseEntityHandler<TEntity, TSubEntity, TWorkingCopy> 
    implements EntityHandler<TEntity, TSubEntity, TWorkingCopy> {
    protected db: Dexie;
    
    abstract createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity>;
    abstract getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined>;
    abstract updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void>;
    abstract deleteEntity(nodeId: TreeNodeId): Promise<void>;
  }
  ```
- **テスト要件**:
  - [ ] 抽象メソッドの定義確認
  - [ ] 継承クラスでの実装確認
  - [ ] データベース接続の確認
- **完了条件**:
  - [ ] 基底クラスが定義されている
  - [ ] Dexie統合準備完了

#### Day 17 (TASK-0017): エンティティCRUD実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0016
- **実装詳細**:
  - createEntity: 新規エンティティ作成、timestamp自動設定
  - getEntity: nodeIdによる取得
  - updateEntity: 部分更新、version増加
  - deleteEntity: 物理削除
- **テスト要件**:
  - [ ] 各CRUD操作のテスト
  - [ ] タイムスタンプ自動更新
  - [ ] バージョン管理の確認
- **完了条件**:
  - [ ] 全CRUD操作が動作する
  - [ ] エラーケースが処理される

#### Day 18 (TASK-0018): サブエンティティ操作

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0017
- **実装詳細**:
  ```typescript
  createSubEntity(nodeId: TreeNodeId, subEntityType: string, data: TSubEntity): Promise<void>;
  getSubEntities(nodeId: TreeNodeId, subEntityType: string): Promise<TSubEntity[]>;
  deleteSubEntities(nodeId: TreeNodeId, subEntityType: string): Promise<void>;
  ```
- **テスト要件**:
  - [ ] サブエンティティの作成
  - [ ] 複数サブエンティティの管理
  - [ ] 親エンティティとの関連
- **完了条件**:
  - [ ] サブエンティティ機能が完成
  - [ ] 親子関係が正しく管理される

#### Day 19 (TASK-0019): ワーキングコピー管理

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-203 🟢
- **依存タスク**: TASK-0018
- **実装詳細**:
  ```typescript
  createWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy>;
  commitWorkingCopy(nodeId: TreeNodeId, workingCopy: TWorkingCopy): Promise<void>;
  discardWorkingCopy(nodeId: TreeNodeId): Promise<void>;
  ```
- **テスト要件**:
  - [ ] ワーキングコピー作成
  - [ ] コミット処理
  - [ ] ロールバック処理
- **完了条件**:
  - [ ] Copy-on-Writeパターン実装
  - [ ] コミット/破棄が動作する

#### Day 20 (TASK-0020): EntityHandlerテスト完成

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: NFR-301 🟢
- **依存タスク**: TASK-0019
- **実装詳細**:
  - 全EntityHandlerメソッドのテスト
  - エラーケースの網羅
  - 並行処理のテスト
  - トランザクション管理
- **テスト要件**:
  - [ ] カバレッジ80%以上
  - [ ] 異常系テスト完備
  - [ ] パフォーマンステスト
- **完了条件**:
  - [ ] 全テスト合格
  - [ ] ドキュメント完成

### Week 2: ライフサイクル管理

#### Day 21 (TASK-0021): NodeLifecycleManager基本実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003 🟢
- **依存タスク**: TASK-0012
- **実装詳細**:
  ```typescript
  export class NodeLifecycleManager {
    private registry: NodeTypeRegistry;
    
    async executeLifecycleHook<THookName extends keyof NodeLifecycleHooks>(
      hookName: THookName,
      nodeType: TreeNodeType,
      ...args: Parameters<NodeLifecycleHooks[THookName]>
    ): Promise<void> {
      // フック実行ロジック
    }
  }
  ```
- **テスト要件**:
  - [ ] フック実行順序の確認
  - [ ] 非同期処理の管理
  - [ ] エラー伝播の確認
- **完了条件**:
  - [ ] 基本構造が完成
  - [ ] レジストリとの統合

#### Day 22 (TASK-0022): Create系ライフサイクル実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003, REQ-104 🟢
- **依存タスク**: TASK-0021
- **実装詳細**:
  ```typescript
  async handleNodeCreation(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<TreeNodeId> {
    await this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);
    const nodeId = await this.createNodeCore(parentId, nodeData);
    // EntityHandler呼び出し
    await this.executeLifecycleHook('afterCreate', nodeType, nodeId, entity);
    return nodeId;
  }
  ```
- **テスト要件**:
  - [ ] beforeCreate実行確認
  - [ ] afterCreate実行確認
  - [ ] エラー時のロールバック
- **完了条件**:
  - [ ] 作成フローが完成
  - [ ] 警告/エラー処理実装 🟢

#### Day 23 (TASK-0023): Update系ライフサイクル実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003, REQ-104 🟢
- **依存タスク**: TASK-0022
- **実装詳細**:
  - handleNodeUpdate実装
  - beforeUpdate/afterUpdateフック
  - 部分更新のサポート
  - バージョン管理
- **テスト要件**:
  - [ ] 更新フローテスト
  - [ ] 楽観的ロックテスト
  - [ ] 警告継続の確認
- **完了条件**:
  - [ ] 更新処理が完成
  - [ ] バージョン競合処理

#### Day 24 (TASK-0024): Delete系ライフサイクル実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003, REQ-104 🟢
- **依存タスク**: TASK-0023
- **実装詳細**:
  - handleNodeDeletion実装
  - beforeDelete/afterDeleteフック
  - カスケード削除
  - リソースクリーンアップ
- **テスト要件**:
  - [ ] 削除フローテスト
  - [ ] 関連データ削除確認
  - [ ] クリーンアップ確認
- **完了条件**:
  - [ ] 削除処理が完成
  - [ ] リソースリークなし

#### Day 25 (TASK-0025): エラーハンドリング統合

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-104, EDGE-003 🟢
- **依存タスク**: TASK-0024
- **実装詳細**:
  - 警告レベル: console.warn継続
  - エラーレベル: ロールバック
  - エラー情報の構造化
  - ログ出力の最適化
- **テスト要件**:
  - [ ] 警告時の継続動作
  - [ ] エラー時のロールバック
  - [ ] ログ出力の確認
- **完了条件**:
  - [ ] エラー処理方針準拠 🟢
  - [ ] 適切なログレベル

### Week 3: Worker API拡張

#### Day 26 (TASK-0026): WorkerAPIRegistry実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-005 🟢
- **依存タスク**: TASK-0025
- **実装詳細**:
  ```typescript
  export class WorkerAPIRegistry {
    private extensions: Map<TreeNodeType, WorkerAPIExtension>;
    
    register<T extends Record<string, WorkerAPIMethod>>(
      extension: WorkerAPIExtension<T>
    ): void;
    
    async invokeMethod<TMethod extends keyof TMethods>(
      nodeType: TreeNodeType,
      methodName: TMethod,
      ...args: Parameters<TMethods[TMethod]>
    ): Promise<ReturnType<TMethods[TMethod]>>;
  }
  ```
- **テスト要件**:
  - [ ] API登録テスト
  - [ ] メソッド呼び出しテスト
  - [ ] 型安全性の確認
- **完了条件**:
  - [ ] レジストリが動作する
  - [ ] 型推論が機能する

#### Day 27 (TASK-0027): 型安全なAPI呼び出し

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-005, REQ-402 🟢
- **依存タスク**: TASK-0026
- **実装詳細**:
  - ジェネリクスによる型推論
  - 引数/戻り値の型チェック
  - 実行時型検証
  - エラーメッセージの改善
- **テスト要件**:
  - [ ] 型推論テスト
  - [ ] 型エラー検出テスト
  - [ ] 実行時検証テスト
- **完了条件**:
  - [ ] 完全な型安全性
  - [ ] 開発時の型補完

#### Day 28 (TASK-0028): Worker スレッド統合

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-005 🟢
- **依存タスク**: TASK-0027
- **実装詳細**:
  - Worker スレッドでの実行
  - メッセージパッシング
  - 非同期処理の管理
  - エラー伝播
- **テスト要件**:
  - [ ] Worker通信テスト
  - [ ] 非同期処理テスト
  - [ ] エラー伝播テスト
- **完了条件**:
  - [ ] Workerで動作する
  - [ ] エラーが正しく伝播

#### Day 29 (TASK-0029): API拡張サンプル実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-005 🟡
- **依存タスク**: TASK-0028
- **実装詳細**:
  - getMapPreview API実装例
  - exportMapConfig API実装例
  - parseCSVStyles API実装例
  - ドキュメント作成
- **テスト要件**:
  - [ ] 各APIの動作確認
  - [ ] 引数バリデーション
  - [ ] エラーケース
- **完了条件**:
  - [ ] サンプルが動作する
  - [ ] ドキュメント完備

#### Day 30 (TASK-0030): Worker API統合テスト

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-005 🟢
- **依存タスク**: TASK-0029
- **実装詳細**:
  - E2Eシナリオテスト
  - 複数プラグインAPI連携
  - パフォーマンス測定
  - メモリリーク確認
- **テスト要件**:
  - [ ] 統合シナリオ実行
  - [ ] 負荷テスト
  - [ ] メモリプロファイル
- **完了条件**:
  - [ ] 全テスト合格
  - [ ] パフォーマンス基準達成

### Week 4: データベース統合

#### Day 31 (TASK-0031): Dexie設定と初期化

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: DIRECT
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0030
- **実装詳細**:
  - Dexie初期設定
  - IndexedDB接続
  - データベースバージョン管理
  - 開発/本番環境設定
- **完了条件**:
  - [ ] Dexie接続確立
  - [ ] バージョン管理動作
  - [ ] 環境別設定完了

#### Day 32 (TASK-0032): 動的スキーマ登録

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0031
- **実装詳細**:
  ```typescript
  private registerDatabaseSchema(definition: NodeTypeDefinition): void {
    const { database } = definition;
    // Dexieスキーマの動的追加
    // インデックス設定
    // ストア作成
  }
  ```
- **テスト要件**:
  - [ ] スキーマ登録テスト
  - [ ] インデックス作成確認
  - [ ] 複数スキーマ統合
- **完了条件**:
  - [ ] 動的スキーマ追加
  - [ ] インデックス最適化

#### Day 33 (TASK-0033): マイグレーション機能

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟡
- **依存タスク**: TASK-0032
- **実装詳細**:
  - スキーマバージョン管理
  - アップグレード処理
  - ダウングレード処理
  - データ変換
- **テスト要件**:
  - [ ] バージョンアップテスト
  - [ ] データ移行テスト
  - [ ] ロールバックテスト
- **完了条件**:
  - [ ] 安全なマイグレーション
  - [ ] データ整合性維持

#### Day 34 (TASK-0034): トランザクション管理

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: EDGE-201 🟢
- **依存タスク**: TASK-0033
- **実装詳細**:
  - Dexieトランザクション
  - ACID特性の保証
  - デッドロック回避
  - 楽観的ロック実装
- **テスト要件**:
  - [ ] トランザクション動作
  - [ ] ロールバックテスト
  - [ ] 並行処理テスト
- **完了条件**:
  - [ ] ACID特性保証
  - [ ] 楽観的ロック動作

#### Day 35 (TASK-0035): Phase 2統合テスト

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003〜005 🟢
- **依存タスク**: TASK-0034
- **実装詳細**:
  - EntityHandler統合テスト
  - ライフサイクル統合テスト
  - Worker API統合テスト
  - DB操作統合テスト
- **テスト要件**:
  - [ ] 全機能結合テスト
  - [ ] エンドツーエンド
  - [ ] 性能測定
- **完了条件**:
  - [ ] 全統合テスト合格
  - [ ] ドキュメント完成

## フェーズ完了基準

- [ ] 全タスクが完了している (20/20)
- [ ] EntityHandlerが完全動作
- [ ] ライフサイクル管理が機能
- [ ] Worker APIが型安全に動作
- [ ] データベース統合完了
- [ ] テストカバレッジ80%以上
- [ ] パフォーマンス基準達成

## 次フェーズへの引き継ぎ事項

- EntityHandler実装パターン
- ライフサイクルフック使用方法
- Worker API拡張方法
- データベーススキーマ管理
- トランザクション処理方法

## リスクと対策

| リスク | 対策 | 状態 |
|--------|------|------|
| 非同期処理の複雑化 | Promise/async-await統一 | 🟢 |
| データ整合性 | トランザクション管理 | 🟢 |
| 型安全性の維持 | 継続的な型チェック | 🟢 |

## 振り返り記入欄

### 計画との差異
- （Phase完了時に記入）

### 学習事項
- （Phase完了時に記入）

### 改善点
- （Phase完了時に記入）