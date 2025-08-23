# 09-4 自動エンティティライフサイクル管理システム仕様

## はじめに

この章では、HierarchiDBの自動エンティティライフサイクル管理システムの設計と実装について詳細に説明します。本章は以下のような方を対象としています：

**読むべき人**: プラグイン開発者、システムアーキテクト、ライフサイクル管理を担当する開発者、データ整合性を重視する設計者、BaseMap・StyleMap・Shape・Spreadsheet・Projectプラグインのような複雑なエンティティ管理が必要なプラグインを実装する方

**前提知識**: エンティティ分類システム（2×3分類）、ワーキングコピーパターン、データベースのカスケード削除、参照整合性、非同期処理、TypeScriptの高度な型システム

**読むタイミング**: エンティティ分類システムを理解した後、実際のプラグイン実装を開始する前に読んでください。特に複数エンティティ間の依存関係があるプラグインや、自動データクリーンアップが必要なプラグインを実装する際には、本章の自動ライフサイクル管理機能を活用することで、手動実装の複雑さを大幅に軽減できます。

本システムにより、プラグイン開発者はビジネスロジックに集中でき、データ整合性とライフサイクル管理は自動化されます。

## 1. 概要

この仕様書では、HierarchiDBにプラグインを導入する際に、ツリーノードに紐づくエンティティ（Peer/Group/Relation × Persistent/Ephemeral）を自動的に管理するシステムの設計を定義します。TreeNodeのライフサイクルに合わせて、エンティティのワーキングコピー管理や削除などが自動化されます。

## 2. 現在のアーキテクチャの課題

### 2.1 手動ライフサイクル管理の問題点

- プラグイン開発者が各エンティティタイプのライフサイクル管理を手動で実装する必要がある
- TreeNodeの削除・移動・複製時に関連エンティティの整合性を保つためのコードの重複
- エンティティ間の依存関係の管理が複雑で、バグの原因となりやすい
- ワーキングコピーの作成・コミット・破棄のパターンがプラグインごとに異なる
- CoreDBとEphemeralDBの使い分けが手動管理

### 2.2 現在の手動実装の例

```typescript
// StyleMapプラグインでの手動実装例
export class StyleMapEntityHandler implements EntityHandler<StyleMapEntity> {
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // 1. 手動でRelationエンティティの参照を削除
    const entity = await this.getEntity(nodeId);
    if (entity?.tableMetadataId) {
      await this.tableMetadataManager.removeReference(entity.tableMetadataId, nodeId);
    }
    
    // 2. 手動でPeerEntityを削除
    await this.database.styleMapEntities.delete(nodeId);
    
    // 3. 手動でワーキングコピーを削除
    await this.database.workingCopies.where('workingCopyOf').equals(nodeId).delete();
  }
}
```

## 3. 自動ライフサイクル管理システムの設計

### 3.1 アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                    TreeNode ライフサイクル                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          AutoLifecycleManager                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │        EntityRegistrationService                │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │        WorkingCopyManager                       │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │        DependencyResolver                       │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│              Plugin Entity Handlers                            │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│   │ Peerエンティティ │  │ Groupエンティティ │  │Relationエンティティ│         │
│   │   Handler    │  │   Handler    │  │   Manager    │         │
│   └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 エンティティ登録システム

#### 3.2.1 エンティティメタデータ定義

```typescript
// packages/core/src/types/entityMetadata.ts

/**
 * エンティティメタデータ
 * 各エンティティタイプの自動管理に必要な情報を定義
 */
export interface EntityMetadata {
  /** エンティティタイプ */
  entityType: EntityType;
  
  /** ストア名（Dexieテーブル名） */
  storeName: string;
  
  /** TreeNodeとの関係性 */
  relationship: EntityRelationship;
  
  /** 依存するエンティティ（削除時の参照チェック用） */
  dependencies?: EntityDependency[];
  
  /** ワーキングコピー設定 */
  workingCopyConfig?: WorkingCopyConfig;
  
  /** カスタムライフサイクルフック */
  customHooks?: EntityLifecycleHooks;
}

/**
 * エンティティタイプ
 */
export type EntityType = 'peer' | 'group' | 'relational';

/**
 * エンティティ関係性の定義
 */
export interface EntityRelationship {
  /** TreeNodeとの関係性タイプ */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  
  /** 外部キーフィールド名 */
  foreignKeyField: string;
  
  /** カスケード削除の設定 */
  cascadeDelete: boolean;
  
  /** 孤立レコードの自動削除 */
  autoCleanupOrphans: boolean;
}

/**
 * エンティティ依存関係
 */
export interface EntityDependency {
  /** 依存先エンティティのストア名 */
  targetStore: string;
  
  /** 依存関係のタイプ */
  dependencyType: 'reference' | 'ownership' | 'shared';
  
  /** 参照フィールド名 */
  referenceField: string;
  
  /** 削除時の動作 */
  onDelete: 'cascade' | 'nullify' | 'restrict';
}

/**
 * ワーキングコピー設定
 */
export interface WorkingCopyConfig {
  /** ワーキングコピーを作成するか */
  enabled: boolean;
  
  /** ワーキングコピーストア名 */
  storeName: string;
  
  /** 自動コミット条件 */
  autoCommitTriggers?: AutoCommitTrigger[];
  
  /** 自動破棄条件 */
  autoDiscardTriggers?: AutoDiscardTrigger[];
}
```

#### 3.2.2 エンティティ登録サービス

```typescript
// packages/worker/src/services/EntityRegistrationService.ts

/**
 * エンティティ登録サービス
 * プラグインからのエンティティメタデータ登録と管理を担当
 */
export class EntityRegistrationService {
  private registrations = new Map<string, EntityMetadata>();
  private nodeTypeToEntities = new Map<TreeNodeType, string[]>();
  
  /**
   * エンティティメタデータを登録
   */
  registerEntity(
    nodeType: TreeNodeType,
    entityKey: string,
    metadata: EntityMetadata
  ): void {
    // 登録の検証
    this.validateEntityMetadata(metadata);
    
    // メタデータを保存
    this.registrations.set(entityKey, metadata);
    
    // ノードタイプ別のインデックスを更新
    const entities = this.nodeTypeToEntities.get(nodeType) || [];
    entities.push(entityKey);
    this.nodeTypeToEntities.set(nodeType, entities);
    
    // 依存関係グラフを更新
    this.updateDependencyGraph(entityKey, metadata);
  }
  
  /**
   * ノードタイプに関連するすべてのエンティティを取得
   */
  getEntitiesByNodeType(nodeType: TreeNodeType): EntityMetadata[] {
    const entityKeys = this.nodeTypeToEntities.get(nodeType) || [];
    return entityKeys
      .map(key => this.registrations.get(key))
      .filter(Boolean) as EntityMetadata[];
  }
  
  /**
   * エンティティメタデータの検証
   */
  private validateEntityMetadata(metadata: EntityMetadata): void {
    // 必須フィールドの確認
    if (!metadata.storeName || !metadata.relationship) {
      throw new Error('Invalid entity metadata: missing required fields');
    }
    
    // 依存関係の循環参照チェック
    this.checkCircularDependencies(metadata);
    
    // ストア名の重複チェック
    this.checkStoreNameConflicts(metadata.storeName);
  }
}
```

### 3.3 自動ライフサイクル管理システム

#### 3.3.1 AutoLifecycleManager

```typescript
// packages/worker/src/services/AutoLifecycleManager.ts

/**
 * 自動ライフサイクル管理マネージャー
 * TreeNodeのライフサイクルイベントに基づいて自動的にエンティティを管理
 */
export class AutoLifecycleManager {
  constructor(
    private registrationService: EntityRegistrationService,
    private workingCopyManager: WorkingCopyManager,
    private dependencyResolver: DependencyResolver,
    private database: Dexie
  ) {}
  
  /**
   * TreeNode作成時の自動処理
   */
  async onNodeCreate(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    
    await this.database.transaction('rw', this.getStoreNames(entities), async () => {
      for (const entityMeta of entities) {
        await this.createEntityIfNeeded(nodeId, entityMeta);
      }
    });
  }
  
  /**
   * TreeNode削除時の自動処理
   */
  async onNodeDelete(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    
    // 依存関係の順序でエンティティを削除
    const sortedEntities = this.dependencyResolver.sortForDeletion(entities);
    
    await this.database.transaction('rw', this.getStoreNames(entities), async () => {
      for (const entityMeta of sortedEntities) {
        await this.deleteEntityWithDependencies(nodeId, entityMeta);
      }
    });
  }
  
  /**
   * TreeNode複製時の自動処理
   */
  async onNodeDuplicate(
    sourceNodeId: TreeNodeId,
    targetNodeId: TreeNodeId,
    nodeType: TreeNodeType
  ): Promise<void> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    
    await this.database.transaction('rw', this.getStoreNames(entities), async () => {
      for (const entityMeta of entities) {
        await this.duplicateEntity(sourceNodeId, targetNodeId, entityMeta);
      }
    });
  }
  
  /**
   * ワーキングコピー作成の自動処理
   */
  async createWorkingCopies(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<WorkingCopySession> {
    const entities = this.registrationService.getEntitiesByNodeType(nodeType);
    const session = new WorkingCopySession(nodeId);
    
    for (const entityMeta of entities) {
      if (entityMeta.workingCopyConfig?.enabled) {
        const workingCopy = await this.workingCopyManager.create(nodeId, entityMeta);
        session.addWorkingCopy(entityMeta.storeName, workingCopy);
      }
    }
    
    return session;
  }
  
  /**
   * ワーキングコピーコミットの自動処理
   */
  async commitWorkingCopies(session: WorkingCopySession): Promise<void> {
    const entities = session.getEntityMetadata();
    
    // 依存関係順序でコミット
    const sortedEntities = this.dependencyResolver.sortForCommit(entities);
    
    await this.database.transaction('rw', session.getStoreNames(), async () => {
      for (const entityMeta of sortedEntities) {
        await this.workingCopyManager.commit(session, entityMeta);
      }
    });
  }
}
```

#### 3.3.2 ワーキングコピーとドラフト管理

##### ワーキングコピーの仕組み

オブジェクトの編集時には自動的にワーキングコピーが作成されます：

- **データベース分離**: CoreDB（オリジナル）とEphemeralDB（ワーキングコピー）
- **ID管理**: オリジナルと同じIDを使用
- **エンティティ管理**: コピーオンライト方式
- **自動同期**: 画面遷移時に自動保存

##### ドラフト状態のサポート

編集中断時の未完成状態を保存可能：

- **isDraftプロパティ**: TreeNodeのドラフト状態を示す
- **UIサポート**: Discard確認ダイアログで「Save as Draft」オプション
- **利用制限**: ドラフト状態では一部機能制限

#### 3.3.3 ワーキングコピーマネージャー

```typescript
// packages/worker/src/services/WorkingCopyManager.ts

/**
 * ワーキングコピー管理サービス
 * エンティティタイプに応じた統一的なワーキングコピー操作を提供
 */
export class WorkingCopyManager {
  /**
   * ワーキングコピーを作成
   */
  async create<T extends PeerEntity>(
    nodeId: TreeNodeId,
    entityMeta: EntityMetadata
  ): Promise<T & WorkingCopyProperties> {
    // 元エンティティを取得
    const originalEntity = await this.database
      .table(entityMeta.storeName)
      .get(nodeId) as T;
    
    if (!originalEntity) {
      throw new Error(`Original entity not found: ${nodeId}`);
    }
    
    // ワーキングコピーを作成
    const workingCopy: T & WorkingCopyProperties = {
      ...originalEntity,
      workingCopyId: crypto.randomUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };
    
    // ワーキングコピーストアに保存
    const workingCopyStore = entityMeta.workingCopyConfig!.storeName;
    await this.database.table(workingCopyStore).add(workingCopy);
    
    return workingCopy;
  }
  
  /**
   * ワーキングコピーをコミット
   */
  async commit(
    session: WorkingCopySession,
    entityMeta: EntityMetadata
  ): Promise<void> {
    const workingCopy = session.getWorkingCopy(entityMeta.storeName);
    if (!workingCopy) return;
    
    // RelationalEntityの参照を更新
    if (entityMeta.entityType === 'relational') {
      await this.updateRelationalReferences(workingCopy, entityMeta);
    }
    
    // メインエンティティを更新
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;
    await this.database.table(entityMeta.storeName).put({
      ...entityData,
      updatedAt: Date.now(),
    });
    
    // ワーキングコピーを削除
    const workingCopyStore = entityMeta.workingCopyConfig!.storeName;
    await this.database.table(workingCopyStore).delete(workingCopy.workingCopyId);
  }
  
  /**
   * RelationalEntityの参照カウントを更新
   */
  private async updateRelationalReferences(
    workingCopy: any,
    entityMeta: EntityMetadata
  ): Promise<void> {
    for (const dependency of entityMeta.dependencies || []) {
      if (dependency.dependencyType === 'reference') {
        const oldValue = workingCopy.original?.[dependency.referenceField];
        const newValue = workingCopy[dependency.referenceField];
        
        if (oldValue !== newValue) {
          // 古い参照を削除
          if (oldValue) {
            await this.decrementReference(dependency.targetStore, oldValue, workingCopy.nodeId);
          }
          
          // 新しい参照を追加
          if (newValue) {
            await this.incrementReference(dependency.targetStore, newValue, workingCopy.nodeId);
          }
        }
      }
    }
  }
}
```

#### 3.3.4 依存関係解決サービス

```typescript
// packages/worker/src/services/DependencyResolver.ts

/**
 * エンティティ依存関係解決サービス
 * エンティティ間の依存関係を分析し、適切な操作順序を決定
 */
export class DependencyResolver {
  private dependencyGraph = new Map<string, string[]>();
  
  /**
   * 削除用の順序でエンティティをソート
   * 依存される側から先に削除
   */
  sortForDeletion(entities: EntityMetadata[]): EntityMetadata[] {
    const graph = this.buildDependencyGraph(entities);
    const sorted = this.topologicalSort(graph, true); // reverse order
    
    return sorted.map(key => 
      entities.find(e => e.storeName === key)
    ).filter(Boolean) as EntityMetadata[];
  }
  
  /**
   * コミット用の順序でエンティティをソート
   * 依存する側から先にコミット
   */
  sortForCommit(entities: EntityMetadata[]): EntityMetadata[] {
    const graph = this.buildDependencyGraph(entities);
    const sorted = this.topologicalSort(graph, false); // normal order
    
    return sorted.map(key => 
      entities.find(e => e.storeName === key)
    ).filter(Boolean) as EntityMetadata[];
  }
  
  /**
   * 依存関係グラフを構築
   */
  private buildDependencyGraph(entities: EntityMetadata[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const entity of entities) {
      if (!graph.has(entity.storeName)) {
        graph.set(entity.storeName, []);
      }
      
      for (const dep of entity.dependencies || []) {
        const deps = graph.get(entity.storeName) || [];
        deps.push(dep.targetStore);
        graph.set(entity.storeName, deps);
      }
    }
    
    return graph;
  }
  
  /**
   * トポロジカルソート
   */
  private topologicalSort(
    graph: Map<string, string[]>,
    reverse: boolean = false
  ): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];
    
    const visit = (node: string): void => {
      if (visiting.has(node)) {
        throw new Error(`Circular dependency detected: ${node}`);
      }
      
      if (visited.has(node)) return;
      
      visiting.add(node);
      
      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visiting.delete(node);
      visited.add(node);
      result.push(node);
    };
    
    for (const node of graph.keys()) {
      visit(node);
    }
    
    return reverse ? result.reverse() : result;
  }
}
```

### 3.4 プラグイン統合パターン

#### 3.4.1 簡略化されたプラグイン定義

```typescript
// packages/plugins/stylemap/src/definitions/StyleMapDefinition.ts

export const StyleMapDefinition: NodeTypeDefinition = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  displayName: 'スタイルマップ',
  
  // 自動ライフサイクル管理の設定
  autoLifecycle: {
    entities: [
      // PeerEntity（StyleMapEntity）
      {
        entityType: 'peer',
        storeName: 'styleMapEntities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
          autoCleanupOrphans: false,
        },
        workingCopyConfig: {
          enabled: true,
          storeName: 'styleMapWorkingCopies',
          autoCommitTriggers: ['onNodeSave'],
          autoDiscardTriggers: ['onNodeDelete', 'onSessionEnd'],
        },
        dependencies: [
          {
            targetStore: 'tableMetadataEntities',
            dependencyType: 'reference',
            referenceField: 'tableMetadataId',
            onDelete: 'nullify',
          }
        ],
      },
      
      // RelationalEntity（TableMetadataEntity）
      {
        entityType: 'relational',
        storeName: 'tableMetadataEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
          autoCleanupOrphans: true, // referenceCount = 0で自動削除
        },
        customHooks: {
          beforeDelete: async (entityId, context) => {
            // カスタム削除前処理
            console.log(`Deleting table metadata: ${entityId}`);
          },
        },
      }
    ],
  },
  
  // 簡略化されたEntityHandler（自動処理に任せる）
  entityHandler: new AutoEntityHandler(), // 基本的なCRUD操作のみ実装
  
  ui: {
    dialogComponent: StyleMapDialog,
    panelComponent: StyleMapPanel,
  },
};
```

#### 3.4.2 AutoEntityHandler基底クラス

```typescript
// packages/worker/src/handlers/AutoEntityHandler.ts

/**
 * 自動ライフサイクル管理対応のエンティティハンドラー基底クラス
 * プラグイン開発者は基本的なCRUD操作のみ実装すればよい
 */
export class AutoEntityHandler<TEntity extends PeerEntity> 
  implements PeerEntityHandler<TEntity> {
  
  constructor(
    protected nodeType: TreeNodeType,
    protected autoLifecycleManager: AutoLifecycleManager
  ) {}
  
  async createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity> {
    // 自動ライフサイクル管理によるエンティティ作成
    await this.autoLifecycleManager.onNodeCreate(nodeId, this.nodeType);
    
    // 作成されたエンティティを取得して返す
    return this.getEntity(nodeId) as Promise<TEntity>;
  }
  
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // 自動ライフサイクル管理による削除処理
    await this.autoLifecycleManager.onNodeDelete(nodeId, this.nodeType);
  }
  
  async createWorkingCopy(nodeId: TreeNodeId): Promise<TEntity & WorkingCopyProperties> {
    // 自動ワーキングコピー作成
    const session = await this.autoLifecycleManager.createWorkingCopies(nodeId, this.nodeType);
    return session.getPrimaryWorkingCopy() as TEntity & WorkingCopyProperties;
  }
  
  async commitWorkingCopy(
    nodeId: TreeNodeId, 
    workingCopy: TEntity & WorkingCopyProperties
  ): Promise<void> {
    // 自動ワーキングコピーコミット
    const session = WorkingCopySession.fromWorkingCopy(workingCopy);
    await this.autoLifecycleManager.commitWorkingCopies(session);
  }
  
  // プラグイン開発者がオーバーライド可能なメソッド
  protected async beforeCreate(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void> {
    // カスタム前処理
  }
  
  protected async afterCreate(nodeId: TreeNodeId, entity: TEntity): Promise<void> {
    // カスタム後処理
  }
}
```

## 4. 実装計画

### 4.1 フェーズ1: 基盤システム構築

1. **EntityMetadata型定義の実装**
   - packages/core/src/types/entityMetadata.ts
   - packages/core/src/types/autoLifecycle.ts

2. **EntityRegistrationServiceの実装**
   - packages/worker/src/services/EntityRegistrationService.ts
   - 基本的な登録・検証機能

3. **DependencyResolverの実装**
   - packages/worker/src/services/DependencyResolver.ts
   - 依存関係グラフとトポロジカルソート

### 4.2 フェーズ2: ライフサイクル管理

1. **AutoLifecycleManagerの実装**
   - packages/worker/src/services/AutoLifecycleManager.ts
   - TreeNodeイベントハンドリング

2. **WorkingCopyManagerの実装**
   - packages/worker/src/services/WorkingCopyManager.ts
   - 統一的なワーキングコピー管理

3. **AutoEntityHandlerの実装**
   - packages/worker/src/handlers/AutoEntityHandler.ts
   - プラグイン開発者向け基底クラス

### 4.3 フェーズ3: プラグイン統合

1. **NodeTypeDefinitionの拡張**
   - autoLifecycleフィールドの追加
   - 既存プラグインの移行サポート

2. **StyleMapプラグインの移行**
   - 新しいAutoEntityHandlerを使用した実装
   - 自動ライフサイクル管理の検証

3. **テスト・ドキュメント整備**
   - 包括的なテストスイート
   - プラグイン開発ガイドの更新

## 5. メリットと期待効果

### 5.1 開発者体験の向上

- **コード量の削減**: 手動ライフサイクル管理コードが不要
- **バグの削減**: 統一的な管理によりヒューマンエラーを防止
- **保守性の向上**: 複雑な依存関係管理が自動化

### 5.2 システムの信頼性向上

- **データ整合性の保証**: 自動的な依存関係管理
- **トランザクション安全性**: 統一的なトランザクション境界
- **パフォーマンス最適化**: 効率的な操作順序の自動決定

### 5.3 プラグインエコシステムの拡大

- **プラグイン開発の簡素化**: 宣言的な設定による開発
- **標準化された実装パターン**: 一貫性のあるプラグイン体験
- **再利用可能なコンポーネント**: 共通ライフサイクル管理の活用

## 6. 今後の拡張可能性

### 6.1 高度な依存関係管理

- **条件付き依存関係**: 特定の条件下でのみ有効な依存関係
- **動的依存関係**: ランタイムで変更される依存関係
- **外部システム連携**: データベース外リソースとの同期

### 6.2 パフォーマンス最適化

- **バッチ処理**: 複数ノードの一括操作
- **遅延削除**: 非同期での依存関係解決
- **キャッシュ機能**: 依存関係グラフのキャッシュ

### 6.3 可観測性・デバッグ支援

- **ライフサイクルイベントログ**: 詳細な操作履歴
- **依存関係可視化**: グラフィカルな依存関係表示
- **パフォーマンス監視**: 操作時間・頻度の追跡

この仕様により、HierarchiDBのプラグインシステムは大幅に簡素化され、より安全で保守しやすいアーキテクチャへと発展します。