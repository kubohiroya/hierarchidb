## 9.3 AOP (Aspect-Oriented Programming) アーキテクチャ仕様

本ドキュメントでは、hierarchidbプロジェクトにおけるAOP方式の導入について、eria-cartographプロジェクトの実装を参考に、詳細な仕様と設計を定義する。

### 9.3.1 目的

- ノードタイプごとの振る舞いを、コア機能から分離して管理
- ノードのライフサイクルに応じた拡張ポイントの提供
- プラグイン形式での機能拡張を可能にする
- クロスカッティングな関心事の統一的な処理

### 9.3.2 主要コンセプト

- **ノードタイプ定義レジストリ**: ノードタイプごとの定義を登録・管理
- **ライフサイクルフック**: ノードの作成・更新・削除時の拡張ポイント
- **エンティティ管理**: ノードに紐づくエンティティとサブエンティティの管理
- **ワーキングコピーパターン**: 安全な編集のためのCopy-on-Write実装

### 9.3.3 ノードタイプ定義システム

#### 9.3.3.1 エンティティアーキテクチャ

HierarchiDBでは、プラグインによって管理されるエンティティを3つのカテゴリに分類し、TreeNodeとの関係性に基づいて異なるライフサイクル管理を行います。

##### PeerEntity（1対1対応エンティティ）
- TreeNodeと1対1で対応するエンティティ
- TreeNodeのライフサイクルと完全に同期
- TreeNodeが削除されると自動的に削除される
- StyleMapEntity、MapDocumentEntityなど

##### GroupEntity（1対N対応エンティティ）
- TreeNodeと1対Nの関係を持つエンティティ
- 個別のライフサイクル管理（TreeNodeが削除されても残存可能）
- 明示的な削除が必要
- TreeNodeRootStateEntityなど

##### RelationalEntity（N対N対応エンティティ）
- 複数のTreeNodeから参照される共有エンティティ
- リファレンスカウントによる自動ライフサイクル管理
- 参照カウントが0になると自動削除
- TableMetadataEntity、StyleRuleEntityなど

#### 9.3.3.2 ノードタイプ定義インターフェース

```typescript
// packages/core/src/types/nodeDefinition.ts

// エンティティ基底インターフェース群
export interface PeerEntityCore {
  nodeId: TreeNodeId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### 9.3.4 実装例：StyleMapプラグイン

#### 9.3.4.1 エンティティ定義

```typescript
// packages/plugins/stylemap/src/types/StyleMapEntity.ts

// StyleMapのプロパティ定義
export interface StyleMapProperties {
  name: string;
  description?: string;
  tableMetadataId?: string; // RelationalEntityへの参照
  filterRules: FilterRule[];
  styleRules: StyleRule[];
  isActive: boolean;
}

// 型合成によるエンティティ定義
export type StyleMapEntity = PeerEntity & StyleMapProperties;
export type StyleMapWorkingCopy = StyleMapEntity & WorkingCopyProperties;

// RelationalEntity（TableMetadata）
export interface TableMetadataEntity extends RelationalEntity {
  name: string;
  columns: ColumnDefinition[];
  contentHash: string;
  sourceUrl?: string;
}
```

#### 9.3.4.2 エンティティハンドラー実装

```typescript
// packages/plugins/stylemap/src/handlers/StyleMapEntityHandler.ts

export class StyleMapEntityHandler implements PeerEntityHandler<StyleMapEntity, never, StyleMapWorkingCopy> {
  constructor(
    private database: StyleMapDatabase,
    private tableMetadataManager: TableMetadataManager
  ) {}

  async createEntity(nodeId: TreeNodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
    const entity: StyleMapEntity = {
      nodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      name: data?.name || 'New StyleMap',
      description: data?.description,
      tableMetadataId: data?.tableMetadataId,
      filterRules: data?.filterRules || [],
      styleRules: data?.styleRules || [],
      isActive: data?.isActive ?? true,
    };

    await this.database.styleMapEntities.add(entity);
    return entity;
  }

  async createWorkingCopy(nodeId: TreeNodeId): Promise<StyleMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`StyleMapEntity not found for node ${nodeId}`);
    }

    return {
      ...entity,
      workingCopyId: crypto.randomUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
    };
  }

  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: StyleMapWorkingCopy): Promise<void> {
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;
    
    await this.database.transaction('rw', [this.database.styleMapEntities], async () => {
      await this.database.styleMapEntities.put({
        ...entityData,
        updatedAt: Date.now(),
        version: entityData.version + 1,
      });
    });
  }

  // RelationalEntity統合
  getRelationalEntityManager<T extends RelationalEntity>(entityType: string): RelationalEntityManager<T> | undefined {
    if (entityType === 'tableMetadata') {
      return this.tableMetadataManager as RelationalEntityManager<T>;
    }
    return undefined;
  }
}
```

#### 9.3.4.3 RelationalEntityManager実装

```typescript
// packages/plugins/stylemap/src/managers/TableMetadataManager.ts

export class TableMetadataManager implements RelationalEntityManager<TableMetadataEntity> {
  constructor(private database: StyleMapDatabase) {}

  async create(data: Omit<TableMetadataEntity, keyof RelationalEntity>): Promise<TableMetadataEntity> {
    const entity: TableMetadataEntity = {
      id: crypto.randomUUID(),
      referenceCount: 0,
      referencingNodeIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
      ...data,
    };

    await this.database.tableMetadataEntities.add(entity);
    return entity;
  }

  async findByContentHash(contentHash: string): Promise<TableMetadataEntity | undefined> {
    return this.database.tableMetadataEntities
      .where('contentHash')
      .equals(contentHash)
      .first();
  }

  async addReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    await this.database.transaction('rw', [this.database.tableMetadataEntities], async () => {
      const entity = await this.database.tableMetadataEntities.get(entityId);
      if (entity) {
        entity.referenceCount++;
        entity.referencingNodeIds.push(nodeId);
        entity.lastAccessedAt = Date.now();
        await this.database.tableMetadataEntities.put(entity);
      }
    });
  }

  async removeReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    await this.database.transaction('rw', [this.database.tableMetadataEntities], async () => {
      const entity = await this.database.tableMetadataEntities.get(entityId);
      if (entity) {
        entity.referenceCount--;
        entity.referencingNodeIds = entity.referencingNodeIds.filter(id => id !== nodeId);
        
        if (entity.referenceCount <= 0) {
          await this.database.tableMetadataEntities.delete(entityId);
        } else {
          await this.database.tableMetadataEntities.put(entity);
        }
      }
    });
  }

  async cleanup(): Promise<void> {
    const entities = await this.database.tableMetadataEntities
      .where('referenceCount')
      .belowOrEqual(0)
      .toArray();
    
    for (const entity of entities) {
      await this.database.tableMetadataEntities.delete(entity.id);
    }
  }
}
```

#### 9.3.4.4 ノードタイプ定義登録

```typescript
// packages/plugins/stylemap/src/definitions/StyleMapDefinition.ts

export const StyleMapDefinition: NodeTypeDefinition<StyleMapEntity, never, StyleMapWorkingCopy> = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  displayName: 'スタイルマップ',
  icon: 'palette',
  color: '#2196F3',
  
  database: {
    entityStore: 'styleMapEntities',
    relationalEntityStores: ['tableMetadataEntities'],
    schema: {
      styleMapEntities: '&nodeId, name, isActive',
      tableMetadataEntities: '&id, contentHash, referenceCount',
    },
    version: 1,
  },
  
  entityHandler: new StyleMapEntityHandler(
    StyleMapDatabase.getInstance(),
    new TableMetadataManager(StyleMapDatabase.getInstance())
  ),
  
  relationalEntityManagers: {
    tableMetadata: new TableMetadataManager(StyleMapDatabase.getInstance()),
  },
  
  lifecycle: {
    afterCreate: async (nodeId, entity) => {
      // PeerEntity作成後の処理
      console.log(`StyleMap created for node ${nodeId}`);
    },
    
    beforeDelete: async (nodeId) => {
      // RelationalEntityの参照を適切に削除
      const entity = await StyleMapDatabase.getInstance().styleMapEntities.get(nodeId);
      if (entity?.tableMetadataId) {
        const manager = new TableMetadataManager(StyleMapDatabase.getInstance());
        await manager.removeReference(entity.tableMetadataId, nodeId);
      }
    },
    
    onRelationalEntityReferenced: async (nodeId, entityType, entityId) => {
      console.log(`Node ${nodeId} referenced ${entityType}:${entityId}`);
    },
    
    onRelationalEntityDereferenced: async (nodeId, entityType, entityId) => {
      console.log(`Node ${nodeId} dereferenced ${entityType}:${entityId}`);
    },
  },
  
  ui: {
    dialogComponent: StyleMapDialog,
    panelComponent: StyleMapPanel,
  },
};
```

### 9.3.5 設計パターンとベストプラクティス

#### 9.3.5.1 エンティティ関係の選択

**PeerEntityを使用する場合：**
- TreeNodeと1対1で対応するデータ
- TreeNodeのライフサイクルと完全に同期
- 例：StyleMapEntity、MapDocumentEntity

**GroupEntityを使用する場合：**
- TreeNodeと1対Nの関係を持つデータ
- 個別のライフサイクル管理が必要
- 例：TreeNodeRootStateEntity

**RelationalEntityを使用する場合：**
- 複数のTreeNodeから参照される共有データ
- リファレンスカウントによる自動管理が有効
- 例：TableMetadataEntity、StyleRuleEntity

#### 9.3.5.2 型合成パターン

```typescript
// プロパティインターフェースを分離
export interface MyNodeProperties {
  name: string;
  value: number;
}

// 型合成によるエンティティ定義
export type MyNodeEntity = PeerEntity & MyNodeProperties;
export type MyNodeWorkingCopy = MyNodeEntity & WorkingCopyProperties;
```

#### 9.3.5.3 トランザクション境界

```typescript
// 関連するエンティティを一括で更新
await this.database.transaction('rw', [
  this.database.peerEntities,
  this.database.relationalEntities
], async () => {
  // PeerEntity更新
  await this.updatePeerEntity(nodeId, data);
  
  // RelationalEntity参照更新
  if (data.relationalEntityId) {
    await this.relationalManager.addReference(data.relationalEntityId, nodeId);
  }
});
```

### 9.3.6 移行ガイドライン

#### 9.3.6.1 既存コードの更新手順

1. **型定義の更新**
   ```typescript
   // 変更前
   export interface MyEntity extends BaseEntity {
     // ...
   }
   
   // 変更後
   export interface MyEntityProperties {
     // ...
   }
   export type MyEntity = PeerEntity & MyEntityProperties;
   ```

2. **ハンドラーの更新**
   ```typescript
   // 変更前
   export class MyEntityHandler extends BaseEntityHandler<MyEntity> {
     // ...
   }
   
   // 変更後  
   export class MyEntityHandler implements PeerEntityHandler<MyEntity> {
     // ...
   }
   ```

3. **ワーキングコピーの更新**
   ```typescript
   // 変更前
   export interface MyWorkingCopy extends BaseWorkingCopy {
     // ...
   }
   
   // 変更後
   export type MyWorkingCopy = MyEntity & WorkingCopyProperties;
   ```typescript
// packages/core/src/types/lifecycle.ts

export interface NodeLifecycleHooks<
  TEntity extends PeerEntity = PeerEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> {
  // ノードライフサイクル
  beforeCreate?: (
    parentId: TreeNodeId, 
    nodeData: Partial<TreeNode>
  ) => Promise<void>;
  afterCreate?: (
    nodeId: TreeNodeId, 
    entity: TEntity
  ) => Promise<void>;
  
  beforeUpdate?: (
    nodeId: TreeNodeId, 
    changes: Partial<TreeNode>
  ) => Promise<void>;
  afterUpdate?: (
    nodeId: TreeNodeId, 
    entity: TEntity
  ) => Promise<void>;
  
  beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
  afterDelete?: (nodeId: TreeNodeId) => Promise<void>;
  
  // 移動・複製
  beforeMove?: (
    nodeId: TreeNodeId, 
    newParentId: TreeNodeId
  ) => Promise<void>;
  afterMove?: (
    nodeId: TreeNodeId, 
    newParentId: TreeNodeId
  ) => Promise<void>;
  
  beforeDuplicate?: (
    sourceId: TreeNodeId, 
    targetParentId: TreeNodeId
  ) => Promise<void>;
  afterDuplicate?: (
    sourceId: TreeNodeId, 
    newNodeId: TreeNodeId
  ) => Promise<void>;
  
  // ワーキングコピー
  onWorkingCopyCreated?: (
    nodeId: TreeNodeId, 
    workingCopy: TWorkingCopy
  ) => Promise<void>;
  onWorkingCopyCommitted?: (
    nodeId: TreeNodeId, 
    workingCopy: TWorkingCopy
  ) => Promise<void>;
  onWorkingCopyDiscarded?: (
    nodeId: TreeNodeId
  ) => Promise<void>;
}
```
