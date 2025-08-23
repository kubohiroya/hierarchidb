# 6. データモデル統合仕様

## はじめに

この章では、HierarchiDBの包括的なデータモデル設計について詳細に説明します。本章は以下のような方を対象としています：

**読むべき人**: プラグイン開発者、データベース設計者、アーキテクト、ハンドラー実装者、データ永続化層を理解したい開発者

**前提知識**: TypeScript型システム、Dexie.jsの基本的な使用方法、ブランデッド型（Branded Types）の概念、Observer パターン、データベースのインデックス設計

**読むタイミング**: 新規プラグイン開発前の必読事項として、または既存データ構造を理解・拡張する際に参照してください。特にBaseMap、StyleMap、Shape、Spreadsheet、Projectプラグインの実装を理解したい場合や、新たなエンティティ関係の設計時には必須の資料です。

本章で解説する6分類システム（Persistent/Ephemeral × Peer/Group/Relational）は、すべてのプラグインのデータ設計の基盤となっており、適切な分類選択により自動ライフサイクル管理とデータベース最適化の恩恵を受けることができます。

## 概要

HierarchiDBのデータモデルは、コアのTreeNode構造と、プラグインによる拡張エンティティの6分類システムからなる二層構造で設計されています。本章では、これらの統合的なデータモデル、データベース設計、およびサービス層のインターフェースを定義します。

## 6.1 モデル階層構造

```
┌─────────────────────────────────────────────────────────────────┐
│                    HierarchiDB Data Model                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Core Tree Structure (TreeNode, Tree, TreeRootState)  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - TreeNode (基本ツリー構造)                              │    │
│  │  - Tree (ツリーメタデータ)                               │    │
│  │  │  - TreeRootState (展開状態)                          │    │
│  │  - WorkingCopy (一時編集データ)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Plugin Entity Classification (6-Class System)        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            │ Peer        │ Group       │ Relational    │    │
│  │ Persistent │ 設定データ   │ 成果物      │ 共有リソース   │    │
│  │ Ephemeral  │ UI状態      │ 中間データ   │ セッション    │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Database Storage Strategy                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  CoreDB (Persistent): 永続データ、長期保存               │    │
│  │  EphemeralDB (Ephemeral): 一時データ、セッション管理     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 6.2 コア構造定義（Layer 1）

### 6.2.1 基本型定義

```typescript
// Opaque/Branded型による型安全性
export type UUID = string & { readonly __brand: 'UUID' };
export type TreeId = string & { readonly __brand: 'TreeId' };
export type NodeId = string & { readonly __brand: 'NodeId' };
export type Timestamp = number; // Date.now()形式

// ルートノードタイプ
export type TreeRootNodeType = 'SuperRoot' | 'Root' | 'TrashRoot';
export type TreeNodeType = TreeRootNodeType | 'folder' | 'file' | string; // プラグイン拡張可能

// 特殊ID型
export type SuperRootNodeId = NodeId & { readonly __type: 'SuperRoot' };
export type RootNodeId = NodeId & { readonly __type: 'Root' };
export type TrashRootNodeId = NodeId & { readonly __type: 'TrashRoot' };
export type TreeRootNodeId = SuperRootNodeId | RootNodeId | TrashRootNodeId;
export type RegularNodeId = NodeId & { readonly __type: 'Regular' };
```

### 6.2.2 ツリー構造モデル

```typescript
// ツリーメタデータ
export interface Tree {
  id: TreeId;
  rootNodeId: RootNodeId;
  trashRootNodeId: TrashRootNodeId;
  superRootNodeId: SuperRootNodeId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ベースノード構造
export interface TreeNodeBase {
  nodeType: TreeNodeType;
  id: NodeId;
  parentNodeId: NodeId;
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

// 拡張プロパティ
export interface DescendantProperties {
  hasChild: boolean;
}

export interface ReferenceProperties {
  references?: NodeId[];
}

export interface TrashItemProperties {
  originalName: string;
  originalParentNodeId: NodeId;
  removedAt: Timestamp;
}

// 統合ノード型
export type TreeNode = TreeNodeBase & 
  DescendantProperties & 
  Partial<ReferenceProperties> & 
  Partial<TrashItemProperties>;

// ワーキングコピー（一時編集用）
export interface WorkingCopyProperties {
  workingCopyId: UUID;
  workingCopyOf: NodeId;
  copiedAt: Timestamp;
  isDirty: boolean;
}

export type WorkingCopy = TreeNode & WorkingCopyProperties;
```

### 6.2.3 ツリー状態管理

```typescript
// ルートごとの展開状態
export interface TreeRootState {
  id: TreeId;
  treeRootNodeType: TreeRootNodeType;
  expanded: true | Record<NodeId, boolean>;
  version: number;
}

// 状態変更通知
export interface ExpandedStateChanges {
  id: TreeId;
  rootNodeId: TreeRootNodeId;
  pageNodeId: NodeId;
  changes: true | Record<NodeId, boolean | null>;
  version: number;
}

export interface SubTreeChanges {
  id: TreeId;
  rootNodeId: TreeRootNodeId;
  pageNodeId: NodeId;
  changes: Record<NodeId, (TreeNodeWithChildren | null)>;
  version: number;
}

export type TreeNodeWithChildren = TreeNode & { children?: NodeId[] };
```

## 6.3 プラグインエンティティ6分類システム（Layer 2）

### 6.3.1 分類マトリックス

```typescript
// 永続性による分類
export type PersistenceType = 'persistent' | 'ephemeral';

// 関係性による分類
export type RelationshipType = 'peer' | 'group' | 'relational';

// 6分類の組み合わせ
export type EntityClassification = 
  | 'persistent-peer'      // 永続1対1: 設定データ
  | 'persistent-group'     // 永続1対N: 成果物
  | 'persistent-relational'// 永続N対N: 共有リソース
  | 'ephemeral-peer'       // 一時1対1: UI状態
  | 'ephemeral-group'      // 一時1対N: 中間データ
  | 'ephemeral-relational';// 一時N対N: セッション
```

### 6.3.2 基底エンティティ定義

```typescript
// 共通プロパティ
export interface EntityCore {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

// PeerEntity（1対1関係）
export interface PeerEntity extends EntityCore {
  nodeId: NodeId;
}

// GroupEntity（1対N関係）
export interface GroupEntity extends EntityCore {
  id: UUID;
  parentNodeId: NodeId;
  type: string;
  index?: number; // グループ内順序
}

// RelationalEntity（N対N関係）
export interface RelationalEntity extends EntityCore {
  id: UUID;
  referenceCount: number;
  referencingNodeIds: NodeId[];
  lastAccessedAt: Timestamp;
}
```

### 6.3.3 永続性による拡張

```typescript
// Persistent拡張
export interface PersistentMetadata {
  retentionPolicy: 'forever' | 'until_parent_deleted' | 'time_based';
  maxAge?: number; // ms
  compressionEnabled: boolean;
  contentHash?: string; // 重複排除用
}

// Ephemeral拡張
export interface EphemeralMetadata {
  sessionId: UUID;
  workingCopyId?: UUID;
  expiresAt: Timestamp;
  autoDeleteTriggers: AutoDeleteTrigger[];
}

export interface AutoDeleteTrigger {
  event: 'dialog_close' | 'session_complete' | 'working_copy_discard' | 'idle_timeout';
  condition?: any; // イベント固有の条件
  delay?: number; // 遅延削除時間（ms）
}
```

### 6.3.4 具体的エンティティ型定義

```typescript
// PersistentPeerEntity（設定データ）
export interface PersistentPeerEntity extends PeerEntity {
  persistentMetadata: PersistentMetadata;
}

// EphemeralPeerEntity（UI状態）
export interface EphemeralPeerEntity extends PeerEntity {
  ephemeralMetadata: EphemeralMetadata;
}

// PersistentGroupEntity（成果物）
export interface PersistentGroupEntity extends GroupEntity {
  persistentMetadata: PersistentMetadata;
}

// EphemeralGroupEntity（中間データ）
export interface EphemeralGroupEntity extends GroupEntity {
  ephemeralMetadata: EphemeralMetadata;
  dependencies?: UUID[]; // 依存する他のエンティティ
}

// PersistentRelationalEntity（共有リソース）
export interface PersistentRelationalEntity extends RelationalEntity {
  persistentMetadata: PersistentMetadata;
  sharedMetadata: {
    shareCount: number;
    accessFrequency: number;
    strongReferences: NodeId[]; // 削除阻止
    weakReferences: NodeId[];   // 削除非阻止
  };
}

// EphemeralRelationalEntity（セッション）
export interface EphemeralRelationalEntity extends RelationalEntity {
  ephemeralMetadata: EphemeralMetadata;
  sessionReferences: {
    referencingSessions: UUID[];
    sessionCount: number;
    primarySession?: UUID;
  };
}
```

## 6.4 データベース設計（Layer 3）

### 6.4.1 データベース分離戦略

```typescript
// データベース管理クラス
export class DatabaseManager {
  private coreDB: Dexie;      // Persistent Entities
  private ephemeralDB: Dexie; // Ephemeral Entities
  
  constructor() {
    this.coreDB = new Dexie('HierarchiDB_Core');
    this.ephemeralDB = new Dexie('HierarchiDB_Ephemeral');
    
    this.setupCoreDBSchema();
    this.setupEphemeralDBSchema();
    this.setupCleanupHandlers();
  }
  
  getDatabase(persistenceType: PersistenceType): Dexie {
    return persistenceType === 'persistent' ? this.coreDB : this.ephemeralDB;
  }
}
```

### 6.4.2 CoreDB スキーマ（永続データ）

```typescript
export class CoreDB extends Dexie {
  trees!: Table<Tree, TreeId>;
  nodes!: Table<TreeNode, NodeId>;
  rootStates!: Table<TreeRootState, [TreeId, TreeRootNodeType]>;
  
  // プラグインエンティティストア（動的登録）
  [storeName: string]: Table<any, any>;
  
  constructor(name: string) {
    super(`${name}-CoreDB`);
    this.version(1).stores({
      trees: '&id, rootNodeId, trashRootNodeId, superRootNodeId',
      nodes: [
        '&id',
        'parentNodeId',
        '&[parentNodeId+name]', // 兄弟名ユニーク
        '[parentNodeId+updatedAt]',
        'removedAt',
        'originalParentNodeId',
        '*references'
      ].join(', '),
      rootStates: '&[id+treeRootNodeType], id'
    });
  }
}
```

### 6.4.3 EphemeralDB スキーマ（一時データ）

```typescript
export class EphemeralDB extends Dexie {
  workingCopies!: Table<WorkingCopy, UUID>;
  sessions!: Table<SessionData, UUID>;
  
  // Ephemeralエンティティストア（動的登録）
  [storeName: string]: Table<any, any>;
  
  constructor(name: string) {
    super(`${name}-EphemeralDB`);
    this.version(1).stores({
      workingCopies: '&workingCopyId, workingCopyOf, parentNodeId, updatedAt',
      sessions: '&sessionId, nodeId, expiresAt, [nodeId+sessionType]'
    });
    
    // 起動時自動クリーンアップ
    this.on('open', () => {
      this.cleanupExpiredData();
    });
  }
}
```

### 6.4.4 動的スキーマ登録

```typescript
export interface EntityStoreDefinition {
  storeName: string;
  classification: EntityClassification;
  schema: string; // Dexieスキーマ文字列
  indexDefinitions: IndexDefinition[];
}

export interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

export class DynamicSchemaManager {
  registerEntityStore(definition: EntityStoreDefinition): void {
    const db = this.getTargetDatabase(definition.classification);
    
    // 新しいバージョンでスキーマを追加
    const currentVersion = db.verno;
    db.version(currentVersion + 1).stores({
      [definition.storeName]: definition.schema
    });
  }
  
  private getTargetDatabase(classification: EntityClassification): Dexie {
    return classification.startsWith('persistent') ? this.coreDB : this.ephemeralDB;
  }
}
```

## 6.5 サービス層統合仕様

### 6.5.1 クエリサービス

```typescript
export interface TreeQueryService {
  // Core TreeNode operations
  getTrees(): Promise<Tree[]>;
  getTree(id: TreeId): Promise<Tree | undefined>;
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
  getChildren(parentId: NodeId): Promise<TreeNode[]>;
  getDescendants(nodeId: NodeId, maxDepth?: number): Promise<TreeNode[]>;
  getAncestors(nodeId: NodeId): Promise<TreeNode[]>;
  searchNodes(query: string, rootNodeId?: NodeId): Promise<TreeNode[]>;
  
  // Plugin Entity operations
  getEntityByClassification<T>(
    classification: EntityClassification,
    storeName: string,
    id: string | NodeId
  ): Promise<T | undefined>;
  
  queryEntities<T>(
    classification: EntityClassification,
    storeName: string,
    query: EntityQuery
  ): Promise<T[]>;
}

export interface EntityQuery {
  filters?: Record<string, any>;
  sorting?: { field: string; order: 'asc' | 'desc' }[];
  pagination?: { offset: number; limit: number };
}
```

### 6.5.2 ミューテーションサービス

```typescript
export interface TreeMutationService {
  // Core TreeNode mutations
  createNode(payload: CreateNodePayload): Promise<CommandResult>;
  updateNode(payload: UpdateNodePayload): Promise<CommandResult>;
  deleteNode(payload: DeleteNodePayload): Promise<CommandResult>;
  moveNode(payload: MoveNodePayload): Promise<CommandResult>;
  copyNode(payload: CopyNodePayload): Promise<CommandResult>;
  
  // Working Copy operations
  createWorkingCopy(nodeId: NodeId): Promise<WorkingCopy>;
  updateWorkingCopy(workingCopyId: UUID, changes: Partial<TreeNode>): Promise<void>;
  commitWorkingCopy(workingCopyId: UUID): Promise<CommandResult>;
  discardWorkingCopy(workingCopyId: UUID): Promise<void>;
  
  // Plugin Entity mutations (自動ライフサイクル管理)
  createEntity<T>(
    classification: EntityClassification,
    storeName: string,
    data: Omit<T, keyof EntityCore>
  ): Promise<T>;
  
  updateEntity<T>(
    classification: EntityClassification,
    storeName: string,
    id: string,
    changes: Partial<T>
  ): Promise<void>;
  
  deleteEntity(
    classification: EntityClassification,
    storeName: string,
    id: string
  ): Promise<void>;
}
```

### 6.5.3 オブザーバブルサービス

```typescript
export interface TreeObservableService {
  // Core TreeNode subscriptions
  observeNode(nodeId: NodeId): Observable<TreeChangeEvent>;
  observeChildren(parentId: NodeId): Observable<TreeChangeEvent>;
  observeSubtree(nodeId: NodeId): Observable<SubTreeChanges>;
  observeExpandedState(id: TreeId, rootType: TreeRootNodeType): Observable<ExpandedStateChanges>;
  
  // Plugin Entity subscriptions
  observeEntity<T>(
    classification: EntityClassification,
    storeName: string,
    id: string
  ): Observable<EntityChangeEvent<T>>;
  
  observeEntitiesByNode<T>(
    classification: EntityClassification,
    storeName: string,
    nodeId: NodeId
  ): Observable<EntityChangeEvent<T>[]>;
}

export interface EntityChangeEvent<T> {
  type: 'created' | 'updated' | 'deleted';
  entity: T;
  classification: EntityClassification;
  storeName: string;
  timestamp: Timestamp;
}
```

## 6.6 自動ライフサイクル管理統合

### 6.6.1 エンティティメタデータ

```typescript
export interface EntityMetadata {
  classification: EntityClassification;
  storeName: string;
  relationship: {
    type: RelationshipType;
    foreignKeyField: string;
    cascadeDelete: boolean;
    autoCleanupOrphans: boolean;
  };
  dependencies?: EntityDependency[];
  lifecycle?: {
    onCreate?: EntityLifecycleHook;
    onUpdate?: EntityLifecycleHook;
    onDelete?: EntityLifecycleHook;
  };
}

export interface EntityDependency {
  targetStore: string;
  dependencyType: 'reference' | 'ownership' | 'shared';
  referenceField: string;
  onDelete: 'cascade' | 'nullify' | 'restrict';
}

export type EntityLifecycleHook = (
  entity: any,
  context: LifecycleContext
) => Promise<void>;

export interface LifecycleContext {
  nodeId?: NodeId;
  sessionId?: UUID;
  operation: 'create' | 'update' | 'delete';
  metadata: EntityMetadata;
}
```

### 6.6.2 統合ライフサイクルマネージャー

```typescript
export class IntegratedLifecycleManager {
  constructor(
    private coreDB: CoreDB,
    private ephemeralDB: EphemeralDB,
    private cleanupService: EphemeralCleanupService
  ) {}
  
  async onNodeCreate(nodeId: NodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.getRegisteredEntities(nodeType);
    
    for (const metadata of entities) {
      await this.createEntity(nodeId, metadata);
    }
  }
  
  async onNodeDelete(nodeId: NodeId, nodeType: TreeNodeType): Promise<void> {
    const entities = this.getRegisteredEntities(nodeType);
    const sortedEntities = this.sortForDeletion(entities);
    
    for (const metadata of sortedEntities) {
      await this.deleteEntity(nodeId, metadata);
    }
  }
  
  async onDialogClose(nodeId: NodeId, dialogType: string): Promise<void> {
    await this.cleanupService.cleanupEphemeralEntities(nodeId, 'dialog_close');
  }
  
  async onSessionComplete(sessionId: UUID): Promise<void> {
    await this.cleanupService.cleanupEphemeralEntities(sessionId, 'session_complete');
  }
}
```

## 6.7 プラグイン統合パターン

### 6.7.1 プラグイン定義例

```typescript
// StyleMapプラグインの定義例
export const StyleMapPluginDefinition: PluginDefinition = {
  nodeType: 'stylemap',
  entities: [
    {
      classification: 'persistent-peer',
      storeName: 'styleMapEntities',
      schema: '&nodeId, name, isActive, tableMetadataId',
      relationship: {
        type: 'peer',
        foreignKeyField: 'nodeId',
        cascadeDelete: true,
        autoCleanupOrphans: false
      },
      dependencies: [
        {
          targetStore: 'tableMetadataEntities',
          dependencyType: 'reference',
          referenceField: 'tableMetadataId',
          onDelete: 'nullify'
        }
      ]
    },
    {
      classification: 'persistent-relational',
      storeName: 'tableMetadataEntities',
      schema: '&id, contentHash, referenceCount, *referencingNodeIds',
      relationship: {
        type: 'relational',
        foreignKeyField: 'referencingNodeIds',
        cascadeDelete: false,
        autoCleanupOrphans: true
      }
    }
  ]
};

// Shapesプラグインの定義例（6分類全て使用）
export const ShapesPluginDefinition: PluginDefinition = {
  nodeType: '_shapes_buggy',
  entities: [
    // 最終設定（PersistentPeer）
    {
      classification: 'persistent-peer',
      storeName: 'shapesEntities',
      schema: '&nodeId, name, style, metadata'
    },
    // 最終成果物（PersistentGroup）
    {
      classification: 'persistent-group',
      storeName: 'vectorTileEntities',
      schema: '&id, parentNodeId, zoom, x, y, data'
    },
    // ダイアログ状態（EphemeralPeer）
    {
      classification: 'ephemeral-peer',
      storeName: 'shapesDialogStates',
      schema: '&nodeId, currentStep, formData, sessionId'
    },
    // 中間処理データ（EphemeralGroup）
    {
      classification: 'ephemeral-group',
      storeName: 'batchBufferEntities',
      schema: '&id, parentNodeId, sessionId, stage, data'
    },
    // バッチセッション（EphemeralRelational）
    {
      classification: 'ephemeral-relational',
      storeName: 'batchSessionEntities',
      schema: '&id, *referencingNodeIds, status, config'
    },
    // 共有設定テンプレート（PersistentRelational）
    {
      classification: 'persistent-relational',
      storeName: 'batchConfigTemplates',
      schema: '&id, name, config, *referencingNodeIds, shareCount'
    }
  ]
};
```

この統合仕様により、HierarchiDBは柔軟で拡張性のあるデータモデルを提供し、プラグイン開発者は6分類システムの恩恵を受けながら、自動ライフサイクル管理による安全で効率的なデータ管理を実現できます。