# プラグインアーキテクチャ Phase 1: 基盤構築

## フェーズ概要

- **期間**: 3週間（15営業日）
- **目標**: NodeTypeRegistryとプラグイン基本インターフェースの実装
- **成果物**: 動作するレジストリ、型定義、基本的なテスト
- **担当**: アーキテクト主導、バックエンド開発支援

## 週次計画

### Week 1: 型定義と基本インターフェース
- **目標**: プラグインシステムの型定義完成
- **成果物**: TypeScript型定義、インターフェース

### Week 2: NodeTypeRegistry実装
- **目標**: シングルトンレジストリの実装
- **成果物**: NodeTypeRegistry、基本的な登録・取得機能

### Week 3: テストとドキュメント
- **目標**: 単体テストとAPI仕様書作成
- **成果物**: テストカバレッジ80%以上、ドキュメント

## 日次タスク

### Week 1: 型定義と基本インターフェース

#### Day 1 (TASK-0001): プロジェクト構造準備

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: DIRECT
- **要件リンク**: REQ-001, REQ-401 🟢
- **依存タスク**: なし
- **実装詳細**:
  - packages/core/src/types/ディレクトリ作成
  - packages/core/src/registry/ディレクトリ作成
  - packages/core/src/plugin/ディレクトリ作成
  - tsconfig.json設定（strict: true）
  - package.json依存関係追加
- **完了条件**:
  - [ ] ディレクトリ構造が作成されている
  - [ ] TypeScript設定が完了している
  - [ ] pnpm installが成功する
- **注意事項**: TypeScript strictモードを必須とする 🟢

#### Day 2 (TASK-0002): BaseEntity型定義

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-002 🟢
- **依存タスク**: TASK-0001
- **実装詳細**:
  ```typescript
  // packages/core/src/types/nodeDefinition.ts
  export interface BaseEntity {
    nodeId: TreeNodeId;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    version: number;
  }
  export interface BaseSubEntity {...}
  export interface BaseWorkingCopy extends BaseEntity {...}
  ```
- **テスト要件**:
  - [ ] 型定義のコンパイルテスト
  - [ ] 継承関係のテスト
  - [ ] 必須フィールドの検証
- **完了条件**:
  - [ ] 全ての基本型が定義されている
  - [ ] TypeScriptコンパイルエラーなし
  - [ ] JSDocコメント完備

#### Day 3 (TASK-0003): NodeTypeDefinition インターフェース

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-002 🟢
- **依存タスク**: TASK-0002
- **実装詳細**:
  ```typescript
  export interface NodeTypeDefinition<
    TEntity extends BaseEntity = BaseEntity,
    TSubEntity extends BaseSubEntity = BaseSubEntity,
    TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
  > {
    readonly nodeType: TreeNodeType;
    readonly name: string;
    readonly displayName: string;
    readonly database: {...};
    readonly entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
    readonly lifecycle?: NodeLifecycleHooks<TEntity>;
    readonly ui?: {...};
    readonly api?: {...};
    readonly validation?: {...};
  }
  ```
- **テスト要件**:
  - [ ] ジェネリクス型の動作確認
  - [ ] 必須/オプションフィールドの検証
  - [ ] 型推論のテスト
- **完了条件**:
  - [ ] 完全な型定義が作成されている
  - [ ] 設計文書と一致している 🟢

#### Day 4 (TASK-0004): UnifiedPluginDefinition インターフェース

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-002 🟢
- **依存タスク**: TASK-0003
- **実装詳細**:
  ```typescript
  export interface UnifiedPluginDefinition<...> extends NodeTypeDefinition<...> {
    readonly routing: {
      actions: Record<string, PluginRouterAction>;
      defaultAction?: string;
    };
    readonly meta: {
      version: string;
      description?: string;
      author?: string;
      tags?: string[];
      dependencies?: string[];
    };
  }
  ```
- **テスト要件**:
  - [ ] NodeTypeDefinitionとの互換性
  - [ ] React Router統合の型チェック
  - [ ] メタデータ構造の検証
- **完了条件**:
  - [ ] 統合型定義が完成している
  - [ ] React Router v7との型互換性 🟢

#### Day 5 (TASK-0005): EntityHandler インターフェース

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-004 🟢
- **依存タスク**: TASK-0002
- **実装詳細**:
  ```typescript
  export interface EntityHandler<TEntity, TSubEntity, TWorkingCopy> {
    createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity>;
    getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined>;
    updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void>;
    deleteEntity(nodeId: TreeNodeId): Promise<void>;
    // サブエンティティ操作
    // ワーキングコピー操作
  }
  ```
- **テスト要件**:
  - [ ] CRUD操作の型安全性
  - [ ] Promise返却値の検証
  - [ ] エラーケースの型定義
- **完了条件**:
  - [ ] 全CRUD操作が定義されている
  - [ ] 非同期操作が適切に型付けされている

### Week 2: NodeTypeRegistry実装

#### Day 6 (TASK-0006): NodeTypeRegistry クラス基本実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001 🟢
- **依存タスク**: TASK-0004
- **実装詳細**:
  ```typescript
  export class NodeTypeRegistry {
    private static instance: NodeTypeRegistry;
    private definitions: Map<TreeNodeType, UnifiedPluginDefinition>;
    private handlers: Map<TreeNodeType, EntityHandler>;
    
    private constructor() {}
    
    static getInstance(): NodeTypeRegistry {
      if (!NodeTypeRegistry.instance) {
        NodeTypeRegistry.instance = new NodeTypeRegistry();
      }
      return NodeTypeRegistry.instance;
    }
  }
  ```
- **テスト要件**:
  - [ ] シングルトンパターンの動作確認
  - [ ] 複数回呼び出しで同一インスタンス
  - [ ] スレッドセーフ性の確認
- **完了条件**:
  - [ ] シングルトンが正しく実装されている
  - [ ] privateコンストラクタが機能する

#### Day 7 (TASK-0007): プラグイン登録機能

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001, REQ-102 🟢
- **依存タスク**: TASK-0006
- **実装詳細**:
  ```typescript
  registerPlugin<TEntity, TSubEntity, TWorkingCopy>(
    definition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    if (this.definitions.has(definition.nodeType)) {
      throw new Error(`Node type ${nodeType} is already registered`);
    }
    // 登録処理
  }
  ```
- **テスト要件**:
  - [ ] 正常登録のテスト
  - [ ] 重複登録エラーのテスト
  - [ ] 型安全性の確認
- **完了条件**:
  - [ ] プラグインが正常に登録される
  - [ ] 重複登録でエラーが発生する 🟢

#### Day 8 (TASK-0008): プラグイン取得機能

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001, EDGE-002 🟢
- **依存タスク**: TASK-0007
- **実装詳細**:
  ```typescript
  getDefinition(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    return this.definitions.get(nodeType);
  }
  getHandler(nodeType: TreeNodeType): EntityHandler | undefined {
    return this.handlers.get(nodeType);
  }
  ```
- **テスト要件**:
  - [ ] 存在するnodeTypeの取得
  - [ ] 存在しないnodeTypeでundefined
  - [ ] null/undefinedで例外 🟢
- **完了条件**:
  - [ ] O(1)での取得が実現されている
  - [ ] 適切なエラーハンドリング

#### Day 9 (TASK-0009): React Router統合機能

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-007 🟢
- **依存タスク**: TASK-0008
- **実装詳細**:
  ```typescript
  getRouterAction(nodeType: TreeNodeType, action: string): PluginRouterAction | undefined {
    const actions = this.routingActions.get(nodeType);
    return actions?.get(action);
  }
  getAvailableActions(nodeType: TreeNodeType): string[] {
    const actions = this.routingActions.get(nodeType);
    return actions ? Array.from(actions.keys()) : [];
  }
  ```
- **テスト要件**:
  - [ ] ルーティングアクションの登録
  - [ ] アクション取得の動作確認
  - [ ] React Router v7との統合テスト
- **完了条件**:
  - [ ] ルーティング情報が正しく管理される
  - [ ] React Routerとの型互換性

#### Day 10 (TASK-0010): プラグイン検索・フィルタリング

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001 🟡
- **依存タスク**: TASK-0009
- **実装詳細**:
  ```typescript
  findPluginsByTag(tag: string): UnifiedPluginDefinition[] {
    return this.getAllDefinitions().filter(def => 
      def.meta?.tags?.includes(tag)
    );
  }
  getPluginDependencies(nodeType: TreeNodeType): string[] {
    const definition = this.getDefinition(nodeType);
    return definition?.meta?.dependencies ?? [];
  }
  ```
- **テスト要件**:
  - [ ] タグによる検索テスト
  - [ ] 依存関係取得テスト
  - [ ] 空の結果セットの処理
- **完了条件**:
  - [ ] 効率的な検索が実装されている
  - [ ] メタデータが活用されている

### Week 3: テストとドキュメント

#### Day 11 (TASK-0011): NodeTypeRegistry単体テスト完成

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: NFR-301 🟢
- **依存タスク**: TASK-0010
- **実装詳細**:
  - Vitestによる包括的な単体テスト
  - シングルトンパターンのテスト
  - 登録・取得・削除の全パターン
  - エラーケースの網羅
- **テスト要件**:
  - [ ] カバレッジ80%以上
  - [ ] エッジケースの網羅
  - [ ] 非同期処理のテスト
- **完了条件**:
  - [ ] 全テストがグリーン
  - [ ] カバレッジ目標達成

#### Day 12 (TASK-0012): ライフサイクルフック型定義

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-003 🟢
- **依存タスク**: TASK-0005
- **実装詳細**:
  ```typescript
  export interface NodeLifecycleHooks<TEntity, TWorkingCopy> {
    beforeCreate?: (parentId: TreeNodeId, nodeData: Partial<TreeNode>) => Promise<void>;
    afterCreate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
    beforeUpdate?: (nodeId: TreeNodeId, changes: Partial<TreeNode>) => Promise<void>;
    afterUpdate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;
    beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
    afterDelete?: (nodeId: TreeNodeId) => Promise<void>;
  }
  ```
- **テスト要件**:
  - [ ] フック呼び出し順序の確認
  - [ ] 非同期処理の検証
  - [ ] エラー処理の型定義
- **完了条件**:
  - [ ] 全ライフサイクルイベントが定義されている
  - [ ] 型安全性が保証されている

#### Day 13 (TASK-0013): エラーハンドリング実装

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-104, REQ-404 🟢
- **依存タスク**: TASK-0012
- **実装詳細**:
  - 警告レベル：console.warnで継続
  - エラーレベル：ロールバック処理
  - null/undefined：例外を投げる
  - エラーメッセージは最小限
- **テスト要件**:
  - [ ] 警告時の継続動作確認
  - [ ] エラー時のロールバック確認
  - [ ] 例外処理のテスト
- **完了条件**:
  - [ ] エラーハンドリング方針に準拠 🟢
  - [ ] 適切なログ出力

#### Day 14 (TASK-0014): API仕様書作成

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: DIRECT
- **要件リンク**: NFR-201 🟢
- **依存タスク**: TASK-0013
- **実装詳細**:
  - NodeTypeRegistry APIドキュメント
  - UnifiedPluginDefinition仕様
  - EntityHandler実装ガイド
  - サンプルコード作成
- **完了条件**:
  - [ ] 全APIが文書化されている
  - [ ] サンプルコードが動作する
  - [ ] TypeDocコメント完備

#### Day 15 (TASK-0015): Phase 1統合テスト

- [ ] **タスク完了**
- **推定工数**: 8時間
- **タスクタイプ**: TDD
- **要件リンク**: REQ-001〜007 🟢
- **依存タスク**: TASK-0014
- **実装詳細**:
  - モックプラグインの作成
  - 登録から取得までの一連のフロー
  - 複数プラグインの統合
  - パフォーマンス測定
- **テスト要件**:
  - [ ] E2Eシナリオテスト
  - [ ] 負荷テスト（100プラグイン）
  - [ ] メモリリークチェック
- **完了条件**:
  - [ ] 統合テスト全合格
  - [ ] パフォーマンス基準達成

## フェーズ完了基準

- [ ] 全タスクが完了している (15/15)
- [ ] NodeTypeRegistryが動作する
- [ ] 型定義が完成している
- [ ] テストカバレッジ80%以上
- [ ] TypeScriptビルドエラー0件
- [ ] API仕様書が完成している
- [ ] サンプルコードが動作する

## 次フェーズへの引き継ぎ事項

- NodeTypeRegistry使用方法
- プラグイン登録手順
- 型定義の活用方法
- テスト実装パターン
- エラーハンドリング方針

## リスクと対策

| リスク | 対策 | 状態 |
|--------|------|------|
| 型定義の複雑化 | 段階的な実装、レビュー強化 | 🟢 |
| シングルトンの並行性 | ロック機構は不要（ビルド時統合） | 🟢 |
| React Router v7互換性 | 早期の統合テスト | 🟡 |

## 振り返り記入欄

### 計画との差異
- （Phase完了時に記入）

### 学習事項
- （Phase完了時に記入）

### 改善点
- （Phase完了時に記入）