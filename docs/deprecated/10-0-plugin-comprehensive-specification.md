# HierarchiDB プラグインシステム包括仕様書

## 概要

HierarchiDBのプラグインシステムは、2×3のエンティティ分類システム（Persistent/Ephemeral × Peer/Group/Relation）を基盤として、Worker層での技術的最適化とUI層でのUX統一を両立する分離アーキテクチャを実現する。既存のbasemap、stylemap実装を活用しながら、shapesプラグインの高度な要件に対応する包括的なプラグインフレームワークを提供する。

## 1. アーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                    HierarchiDB Plugin System                    │
├─────────────────────────────────────────────────────────────────┤
│                      UI Layer (統一プラグイン)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │   Folder     │ │   BaseMap    │ │  StyleMap    │ │  Shapes  │  │
│  │  UI Plugin   │ │  UI Plugin   │ │  UI Plugin   │ │UI Plugin │  │
│  │              │ │              │ │              │ │          │  │
│  │• 基本CRUD    │ │• 地図エディター │ │• 6ステップ     │ │• 4段階    │  │
│  │• フォルダ管理  │ │• プレビュー    │ │  ウィザード    │ │  バッチ   │  │
│  │• 階層構造     │ │• エクスポート  │ │• リアルタイム   │ │• 進捗管理 │  │
│  │              │ │• 地図スタイル   │ │  プレビュー    │ │• エラー   │  │
│  │              │ │              │ │• フィルタ管理   │ │  ハンドリング│  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
│                          ↕ Plugin API                    │
├─────────────────────────────────────────────────────────────────┤
│                   Worker Layer (2×3エンティティ分類)              │
│  ┌────────────────┐    ┌───────────────────────────────────────┐  │
│  │   TreeNode     │    │        2×3エンティティ分類システム      │  │
│  │    System      │    │                                     │  │
│  │                │    │ ┌─────────────┬─────────────┬───────┐ │  │
│  │• treeNodeId    │    │ │ Persistent  │ Ephemeral   │       │ │  │
│  │• parentId      │←─→ │ ├─────────────┼─────────────┤       │ │  │
│  │• treeNodeType  │    │ │StyleMap     │WorkingCopy  │ Peer  │ │  │
│  │• name, etc     │    │ │BaseMap      │ViewState    │       │ │  │
│  │                │    │ ├─────────────┼─────────────┤       │ │  │
│  │• 既存システム   │    │ │VectorTiles  │ShapeData    │ Group │ │  │
│  │  そのまま維持   │    │ │BatchResult  │ProcessData  │       │ │  │
│  │                │    │ ├─────────────┼─────────────┤       │ │  │
│  └────────────────┘    │ │TableMeta    │SessionRef   │Relat  │ │  │
│                        │ │SharedRes    │TempShare    │ional  │ │  │
│                        │ └─────────────┴─────────────┴───────┘ │  │
│                        └───────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Plugin Definition System                        │  │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │  │
│  │ │   BaseMap    │ │  StyleMap    │ │   Shapes     │        │  │
│  │ │    Plugin    │ │    Plugin    │ │    Plugin    │        │  │
│  │ │              │ │              │ │              │        │  │
│  │ │• PeerEntity  │ │• PeerEntity  │ │• GroupEntity │        │  │
│  │ │• 地図設定     │ │• 複合型      │ │• 高度バッチ   │        │  │
│  │ │• シンプル     │ │• Relational  │ │• 多段階処理   │        │  │
│  │ │  ライフサイクル│ │• 6ステップUI  │ │• 4段階パイプ  │        │  │
│  │ └──────────────┘ └──────────────┘ └──────────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 2. エンティティ分類システム詳細

### 2.1 エンティティ分類マトリックス

エンティティは、ツリーノードとの紐付けの構造（Peer/Group/Relation）とライフサイクル（Persistent/Ephemeral）の2軸で分類されます。

```
                    │ Peer        │ Group       │ Relation
────────────────────┼─────────────┼─────────────┼─────────────
Persistent          │ 設定データ   │ 成果物      │ 共有リソース
(CoreDB)            │ • StyleMap  │ • VectorTiles│ • TableMetadata
                    │ • BaseMap   │ • ShapeResult│ • SharedResource
                    │ • Settings  │ • BatchOutput│ • CacheIndex
────────────────────┼─────────────┼─────────────┼─────────────
Ephemeral           │ UI状態      │ 中間データ   │ セッション
(EphemeralDB)       │ • ViewState │ • ShapeData │ • TempReference
                    │ • EditState │ • ProcessData│ • SessionShare
                    │ • UIPrefs   │ • WorkingSet │ • BatchSession
```

### 2.2 各プラグインのエンティティ利用パターン

#### BaseMapプラグイン（シンプルパターン）

```typescript
// PeerEntity - TreeNodeと1対1で対応
export interface BaseMapEntity extends BaseEntity {
  // 1:1関係（TreeNode ↔ BaseMap設定）
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  
  // 地図固有プロパティ
  center: [number, number];
  zoom: number;
  style: string;
  bounds?: [number, number, number, number];
  
  // BaseEntityとしての共通プロパティ
  createdAt: number;
  updatedAt: number;
  version: number;
}

// エンティティ分類での位置づけ
const BaseMapEntityClassification = {
  category: 'Peer×Persistent',
  database: 'CoreDB',
  relationship: '1:1',
  lifecycle: 'TreeNodeと同期',
  storage: 'CoreDB',
  workingCopySupported: true
} as const;
```

#### StyleMapプラグイン（複合パターン）

```typescript
export interface StyleMapEntity extends PeerEntity {
  // 主エンティティ（1:1関係）
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  filename?: string;
  keyColumn?: string;
  valueColumns?: string[];
  styleMapConfig?: StyleMapConfig;
  filterRules?: FilterRule[];
  
  // RelationalEntityへの参照
  tableMetadataId?: string; // TableMetadataEntityへのN:N参照
  
  // PeerEntityプロパティ
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface TableMetadataEntity extends RelationalEntity {
  // N:N関係（複数のStyleMapから参照可能）
  id: string;
  filename: string;
  columns: string[];
  rowCount: number;
  checksum: string;
  
  // 参照カウント管理
  references: TreeNodeId[];
  referenceCount: number;
  lastAccessedAt: number;
  
  // RelationalEntityプロパティ
  createdAt: number;
  updatedAt: number;
}

// エンティティ分類での位置づけ
const StyleMapEntityClassification = {
  primary: {
    category: 'PersistentPeerEntity',
    entityType: 'StyleMapEntity',
    relationship: '1:1',
    lifecycle: 'TreeNodeと同期'
  },
  secondary: [{
    category: 'PersistentRelationalEntity',
    entityType: 'TableMetadataEntity',
    relationship: 'N:N',
    lifecycle: '参照カウント管理'
  }]
} as const;
```

#### Shapesプラグイン（高度パターン）

```typescript
// 最終成果物（PersistentGroupEntity）
export interface VectorTilesEntity extends GroupEntity {
  // 1:N関係（1つのTreeNodeに複数のタイル）
  id: string;
  nodeId: TreeNodeId;
  zoom: number;
  x: number;
  y: number;
  data: Uint8Array; // MVT形式
  size: number;
  generatedAt: number;
  
  // GroupEntityプロパティ
  groupId: string;
  sortOrder: number;
  isActive: boolean;
}

// 処理中間データ（EphemeralGroupEntity）
export interface ShapeDataEntity extends GroupEntity {
  // バッチ処理での一時データ
  id: string;
  nodeId: TreeNodeId;
  sessionId: string;
  stage: 'download' | 'simplify1' | 'simplify2';
  countryCode: string;
  adminLevel: number;
  data: GeoJSON.FeatureCollection;
  processedAt: number;
  
  // EphemeralGroupEntityプロパティ  
  workingCopyId?: string;
  autoCleanup: boolean;
  expiresAt: number;
}

// 共有ソースデータ（PersistentRelationalEntity）
export interface SourceDataEntity extends RelationalEntity {
  // 複数のShapesプロジェクトで共有
  id: string;
  dataSource: string;
  countryCode: string;
  adminLevel: number;
  url: string;
  data: GeoJSON.FeatureCollection;
  
  // RelationalEntityプロパティ
  references: TreeNodeId[];
  referenceCount: number;
  lastAccessedAt: number;
  cacheKey: string;
}

// バッチセッション管理（EphemeralRelationalEntity）
export interface BatchSessionEntity extends RelationalEntity {
  // 一時的なセッション情報
  id: string;
  nodeIds: TreeNodeId[]; // 複数のShapesノードで共有可能
  sessionType: 'download' | 'process' | 'generate';
  config: any;
  status: 'running' | 'paused' | 'completed' | 'failed';
  
  // EphemeralRelationalEntityプロパティ
  references: TreeNodeId[];
  startedAt: number;
  expiresAt: number;
  autoCleanup: boolean;
}

// エンティティ分類での位置づけ
const ShapesEntityClassification = {
  primary: {
    category: 'PersistentGroupEntity',
    entityType: 'VectorTilesEntity',
    relationship: '1:N',
    lifecycle: 'TreeNodeと同期（グループ削除）'
  },
  secondary: [{
    category: 'EphemeralGroupEntity',
    entityType: 'ShapeDataEntity',
    relationship: '1:N',
    lifecycle: 'WorkingCopy削除時自動クリーンアップ'
  }, {
    category: 'PersistentRelationalEntity',
    entityType: 'SourceDataEntity',
    relationship: 'N:N',
    lifecycle: '参照カウント管理'
  }, {
    category: 'EphemeralRelationalEntity',
    entityType: 'BatchSessionEntity',
    relationship: 'N:N',
    lifecycle: 'セッション終了時自動削除'
  }]
} as const;
```

## 3. ワーキングコピーとドラフト管理

### 3.1 ワーキングコピーの仕組み

オブジェクトの編集が開始されると、オブジェクトの「ワーキングコピー」が作成され、ストレージ上で永続化状態となります。

#### 基本概念
- **データベース分離**: CoreDB（オリジナル）とEphemeralDB（ワーキングコピー）
- **ID管理**: オリジナルのツリーノードと同じIDを使用
- **数の制約**: オリジナルに対して0個または1個のワーキングコピー
- **エンティティ管理**: コピーオンライト方式で必要に応じて作成

#### 編集フロー
1. **作成**: 新規作成時はデフォルト値、編集時はオリジナルから複製
2. **編集中**: 画面遷移のたびに自動保存
3. **完了**: ワーキングコピーの内容をオリジナルに反映し破棄
4. **中断**: ワーキングコピーを破棄（ドラフト保存可能な場合あり）

### 3.2 ドラフト状態の管理

編集作業を中断する際に、ワーキングコピーを破棄せずに未完成な状態「ドラフト状態」として残せる場合があります。

#### ドラフト機能
- **定義**: TreeNodeのisDraftプロパティがtrue
- **保存可否**: ツリーノードの種類による
- **制限**: ドラフト状態のオブジェクトは通常の利用に制限
- **UI表示**: Discard確認ダイアログで「Save as Draft」ボタン表示

#### ドラフト対応例
```typescript
// ドラフト保存時の処理
async saveAsDraft(workingCopyId: string): Promise<void> {
  const workingCopy = await this.getWorkingCopy(workingCopyId);
  
  // ワーキングコピーをオリジナルに反映（isDraft=true）
  await this.commitWorkingCopy(workingCopyId, {
    isDraft: true,
    draftMetadata: {
      savedAt: Date.now(),
      reason: 'user_interrupted'
    }
  });
}

// ドラフト再開時の処理
async resumeDraft(nodeId: TreeNodeId): Promise<WorkingCopy> {
  const node = await this.getNode(nodeId);
  
  if (!node.isDraft) {
    throw new Error('Node is not in draft state');
  }
  
  // ドラフトからワーキングコピーを再作成
  return await this.createWorkingCopy(nodeId, {
    resumeFromDraft: true
  });
}
```

## 4. 自動ライフサイクル管理システム

### 4.1 エンティティマネージャー階層

```typescript
// 基底インターフェース
export interface EntityManager<T extends BaseEntity> {
  create(nodeId: TreeNodeId, data: Partial<T>): Promise<T>;
  get(nodeId: TreeNodeId): Promise<T | undefined>;
  update(nodeId: TreeNodeId, changes: Partial<T>): Promise<T>;
  delete(nodeId: TreeNodeId): Promise<void>;
  cleanup(nodeId: TreeNodeId): Promise<void>;
}

// PeerEntityManager
export class PeerEntityManager<T extends PeerEntity> implements EntityManager<T> {
  async create(nodeId: TreeNodeId, data: Partial<T>): Promise<T> {
    const entity = {
      nodeId,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    } as T;
    
    await this.db.add(entity);
    return entity;
  }
  
  async cleanup(nodeId: TreeNodeId): Promise<void> {
    // 1:1関係なので、TreeNode削除時に対応するエンティティも削除
    await this.delete(nodeId);
  }
}

// GroupEntityManager
export class GroupEntityManager<T extends GroupEntity> implements EntityManager<T> {
  async create(nodeId: TreeNodeId, data: Partial<T>): Promise<T> {
    const groupId = data.groupId || generateGroupId();
    const entity = {
      nodeId,
      groupId,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sortOrder: await this.getNextSortOrder(nodeId)
    } as T;
    
    await this.db.add(entity);
    return entity;
  }
  
  async cleanup(nodeId: TreeNodeId): Promise<void> {
    // 1:N関係なので、TreeNode削除時に関連するすべてのエンティティを削除
    const entities = await this.db.where('nodeId').equals(nodeId).toArray();
    await this.db.bulkDelete(entities.map(e => e.id));
  }
}

// RelationalEntityManager
export class RelationalEntityManager<T extends RelationalEntity> implements EntityManager<T> {
  async addReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    const entity = await this.db.get(entityId);
    if (!entity) throw new Error('Entity not found');
    
    if (!entity.references.includes(nodeId)) {
      entity.references.push(nodeId);
      entity.referenceCount = entity.references.length;
      entity.lastAccessedAt = Date.now();
      
      await this.db.put(entity);
    }
  }
  
  async removeReference(entityId: string, nodeId: TreeNodeId): Promise<void> {
    const entity = await this.db.get(entityId);
    if (!entity) return;
    
    entity.references = entity.references.filter(id => id !== nodeId);
    entity.referenceCount = entity.references.length;
    
    if (entity.referenceCount === 0) {
      // 参照カウントが0になったら削除
      await this.db.delete(entityId);
    } else {
      await this.db.put(entity);
    }
  }
  
  async cleanup(nodeId: TreeNodeId): Promise<void> {
    // N:N関係なので、参照を削除し、参照カウントが0になったら自動削除
    const entities = await this.db.where('references').anyOf([nodeId]).toArray();
    
    await Promise.all(entities.map(entity => 
      this.removeReference(entity.id, nodeId)
    ));
  }
}

// EphemeralEntityManager（各種のエフェメラル版）
export class EphemeralPeerEntityManager<T extends PeerEntity> extends PeerEntityManager<T> {
  async cleanup(nodeId: TreeNodeId): Promise<void> {
    await super.cleanup(nodeId);
    // WorkingCopy削除時のクリーンアップも追加
  }
}

export class EphemeralGroupEntityManager<T extends GroupEntity> extends GroupEntityManager<T> {
  async cleanupByWorkingCopy(workingCopyId: string): Promise<void> {
    // WorkingCopy削除時に関連するエフェメラルデータを削除
    const entities = await this.db.where('workingCopyId').equals(workingCopyId).toArray();
    await this.db.bulkDelete(entities.map(e => e.id));
  }
}

export class EphemeralRelationalEntityManager<T extends RelationalEntity> extends RelationalEntityManager<T> {
  async cleanupExpired(): Promise<void> {
    // 期限切れのエフェメラルエンティティを削除
    const now = Date.now();
    const expired = await this.db.where('expiresAt').below(now).toArray();
    await this.db.bulkDelete(expired.map(e => e.id));
  }
}
```

### 4.2 自動ライフサイクル管理の実装

```typescript
export class AutoEntityLifecycleManager {
  private managers = new Map<string, EntityManager<any>>();
  private registrations = new Map<TreeNodeType, EntityRegistration[]>();
  
  constructor() {
    this.initializeManagers();
    this.setupGlobalHooks();
  }
  
  private initializeManagers() {
    // 6分類に対応したマネージャーを登録
    this.managers.set('PeerEntityManager', new PeerEntityManager());
    this.managers.set('GroupEntityManager', new GroupEntityManager());
    this.managers.set('RelationalEntityManager', new RelationalEntityManager());
    this.managers.set('EphemeralPeerEntityManager', new EphemeralPeerEntityManager());
    this.managers.set('EphemeralGroupEntityManager', new EphemeralGroupEntityManager());
    this.managers.set('EphemeralRelationalEntityManager', new EphemeralRelationalEntityManager());
  }
  
  registerPlugin(plugin: WorkerPluginDefinition) {
    const { entityClassification, nodeType } = plugin;
    const registrations: EntityRegistration[] = [];
    
    // 主エンティティを登録
    registrations.push({
      category: entityClassification.primary.category,
      entityType: entityClassification.primary.entityType,
      manager: this.managers.get(entityClassification.primary.manager)!,
      isPrimary: true
    });
    
    // 副エンティティを登録
    entityClassification.secondary?.forEach(secondary => {
      registrations.push({
        category: secondary.category,
        entityType: secondary.entityType,
        manager: this.managers.get(secondary.manager)!,
        isPrimary: false
      });
    });
    
    this.registrations.set(nodeType, registrations);
  }
  
  private setupGlobalHooks() {
    // TreeNode削除時の自動クリーンアップ
    TreeNodeLifecycleHooks.beforeDelete.add(async (nodeId) => {
      const nodeType = await getNodeType(nodeId);
      const registrations = this.registrations.get(nodeType);
      
      if (registrations) {
        await Promise.all(registrations.map(reg => 
          reg.manager.cleanup(nodeId)
        ));
      }
    });
    
    // WorkingCopy削除時の自動クリーンアップ（Ephemeralエンティティ）
    WorkingCopyLifecycleHooks.afterDiscard.add(async (workingCopyId) => {
      const ephemeralManagers = [
        this.managers.get('EphemeralPeerEntityManager'),
        this.managers.get('EphemeralGroupEntityManager'),
        this.managers.get('EphemeralRelationalEntityManager')
      ];
      
      await Promise.all(ephemeralManagers.map(manager => 
        manager?.cleanupByWorkingCopy?.(workingCopyId)
      ));
    });
    
    // 定期的なエフェメラルデータクリーンアップ
    setInterval(async () => {
      const ephemeralRelationalManager = this.managers.get('EphemeralRelationalEntityManager');
      await ephemeralRelationalManager?.cleanupExpired?.();
    }, 60 * 60 * 1000); // 1時間ごと
  }
}
```

## 5. UI層統一プラグインシステム

### 5.1 統一されたUIプラグイン定義

```typescript
export interface UIPluginDefinition {
  // 基本情報
  nodeType: TreeNodeType;
  displayName: string;
  
  // 6分類エンティティ対応
  entitySupport: {
    primary: EntityUIDefinition;
    secondary?: EntityUIDefinition[];
  };
  
  // 機能定義
  capabilities: {
    // 基本CRUD
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canHaveChildren: boolean;
    
    // 6分類システム対応機能
    supportsWorkingCopy: boolean;
    supportsEphemeralData: boolean;
    supportsMultiStep: boolean;
    supportsBulkOperations: boolean;
    supportsRelationalEntities: boolean;
    supportsGroupOperations: boolean;
  };
  
  // UIコンポーネント
  components: {
    // 基本コンポーネント
    icon: React.ComponentType<IconProps>;
    createDialog?: React.ComponentType<CreateDialogProps>;
    editDialog?: React.ComponentType<EditDialogProps>;
    detailPanel?: React.ComponentType<DetailPanelProps>;
    
    // 高度なコンポーネント
    multiStepDialog?: React.ComponentType<MultiStepDialogProps>;
    batchProcessor?: React.ComponentType<BatchProcessorProps>;
    groupManager?: React.ComponentType<GroupManagerProps>;
    
    // プレビュー・ビューア
    preview?: React.ComponentType<PreviewProps>;
    viewer?: React.ComponentType<ViewerProps>;
  };
  
  // CRUDアクションフック
  hooks: UIActionHooks;
  
  // メニュー設定
  menu: MenuConfiguration;
}

interface EntityUIDefinition {
  category: EntityCategory;
  entityType: string;
  uiFeatures: {
    supportsWorkingCopy?: boolean;
    supportsVersioning?: boolean;
    supportsExport?: boolean;
    supportsPreview?: boolean;
    supportsBatchOperations?: boolean;
    supportsGrouping?: boolean;
    customFormFields?: FormField[];
  };
}
```

### 5.2 プラグインごとのUI定義

#### FolderUIPlugin（基本パターン）

```typescript
export const FolderUIPlugin: UIPluginDefinition = {
  nodeType: 'folder',
  displayName: 'Folder',
  
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'TreeNode', // TreeNodeのみ使用
      uiFeatures: {
        supportsWorkingCopy: false,
        supportsVersioning: false,
        supportsExport: false,
        supportsPreview: false
      }
    }
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: true,
    supportsWorkingCopy: false,
    supportsEphemeralData: false,
    supportsMultiStep: false,
    supportsBulkOperations: true,
    supportsRelationalEntities: false,
    supportsGroupOperations: false
  },
  
  components: {
    icon: FolderIcon,
    createDialog: FolderCreateDialog,
    editDialog: FolderEditDialog
  },
  
  hooks: folderUIHooks,
  menu: folderMenuConfig
};
```

#### BaseMapUIPlugin（シンプルPeerEntityパターン）

```typescript
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  displayName: 'Base Map',
  
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true,
        customFormFields: [
          { name: 'center', type: 'coordinate', required: true },
          { name: 'zoom', type: 'slider', min: 0, max: 22, required: true },
          { name: 'style', type: 'select', options: mapStyleOptions }
        ]
      }
    }
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsEphemeralData: false,
    supportsMultiStep: false,
    supportsBulkOperations: false,
    supportsRelationalEntities: false,
    supportsGroupOperations: false
  },
  
  components: {
    icon: MapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    preview: MapPreviewComponent,
    viewer: MapViewerComponent
  },
  
  hooks: baseMapUIHooks,
  menu: baseMapMenuConfig
};
```

#### StyleMapUIPlugin（複合エンティティパターン）

```typescript
export const StyleMapUIPlugin: UIPluginDefinition = {
  nodeType: 'stylemap',
  displayName: 'Style Map',
  
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true
      }
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      uiFeatures: {
        supportsWorkingCopy: false,
        supportsVersioning: true
      }
    }]
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsEphemeralData: false,
    supportsMultiStep: true, // 6ステップウィザード
    supportsBulkOperations: false,
    supportsRelationalEntities: true,
    supportsGroupOperations: false
  },
  
  components: {
    icon: StyleIcon,
    multiStepDialog: StyleMapImporter, // 6ステップウィザード
    editDialog: StyleMapEditDialog,
    preview: StyleMapPreviewComponent
  },
  
  hooks: styleMapUIHooks,
  menu: styleMapMenuConfig
};
```

#### ShapesUIPlugin（高度パターン）

```typescript
export const ShapesUIPlugin: UIPluginDefinition = {
  nodeType: '_shapes_buggy',
  displayName: 'Geographic Shapes',
  
  entitySupport: {
    primary: {
      category: 'PersistentGroupEntity',
      entityType: 'VectorTilesEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true,
        supportsBatchOperations: true,
        supportsGrouping: true
      }
    },
    secondary: [{
      category: 'EphemeralGroupEntity',
      entityType: 'ShapeDataEntity',
      uiFeatures: {
        supportsWorkingCopy: false,
        supportsBatchOperations: true
      }
    }, {
      category: 'PersistentRelationalEntity',
      entityType: 'SourceDataEntity',
      uiFeatures: {
        supportsVersioning: true
      }
    }, {
      category: 'EphemeralRelationalEntity',
      entityType: 'BatchSessionEntity',
      uiFeatures: {
        supportsBatchOperations: true
      }
    }]
  },
  
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsEphemeralData: true,
    supportsMultiStep: true, // 4段階バッチ処理
    supportsBulkOperations: true,
    supportsRelationalEntities: true,
    supportsGroupOperations: true
  },
  
  components: {
    icon: ShapesIcon,
    multiStepDialog: ShapesMultiStepDialog, // 4段階処理UI
    batchProcessor: ShapesBatchProcessor,
    groupManager: ShapesGroupManager,
    preview: ShapesPreviewComponent,
    viewer: ShapesViewerComponent
  },
  
  hooks: shapesUIHooks,
  menu: shapesMenuConfig
};
```

## 6. マルチステップ処理システム

### 6.1 StyleMapの6ステップウィザード

```typescript
export const StyleMapMultiStepDialog: React.FC<MultiStepDialogProps> = ({
  onComplete,
  onCancel
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<StyleMapFormData>({
    // Step 1: 基本情報
    name: '',
    description: '',
    
    // Step 2: ファイルアップロード
    filename: '',
    columns: [],
    tableRows: [],
    
    // Step 3: フィルタ設定
    filterRules: [],
    
    // Step 4: 列選択・マッピング
    selectedKeyColumn: '',
    selectedValueColumns: [],
    keyValueMappings: [],
    
    // Step 5: カラー設定
    styleMapConfig: getDefaultStyleMapConfig(),
    
    // Step 6: プレビュー・確認
    // （他ステップのデータを統合）
  });
  
  const steps = [
    { title: 'Name & Description', component: Step1NameDescription },
    { title: 'Upload Data File', component: Step2FileUpload },
    { title: 'Filter Settings', component: Step3FilterSettings },
    { title: 'Column Selection', component: Step4ColumnSelection },
    { title: 'Color Settings', component: Step5ColorSettings },
    { title: 'PreviewStep & Confirm', component: Step6Preview }
  ];
  
  const handleNext = () => setActiveStep(prev => prev + 1);
  const handleBack = () => setActiveStep(prev => prev - 1);
  
  const handleComplete = async () => {
    // StyleMapエンティティ作成
    const entity = await workerAPI.createNode('stylemap', formData);
    onComplete(entity);
  };
  
  return (
    <Dialog open maxWidth="md" fullWidth>
      <DialogTitle>Import Style Map Data</DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((step, index) => (
            <Step key={index}>
              <StepLabel>{step.title}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {React.createElement(steps[activeStep].component, {
          formData,
          onUpdate: setFormData,
          isValid: validateStep(activeStep, formData)
        })}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button 
          disabled={activeStep === 0}
          onClick={handleBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={activeStep === steps.length - 1 ? handleComplete : handleNext}
          disabled={!validateStep(activeStep, formData)}
        >
          {activeStep === steps.length - 1 ? 'Import' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 6.2 Shapesの4段階バッチ処理

```typescript
export const ShapesBatchProcessor: React.FC<BatchProcessorProps> = ({
  nodeId,
  initialConfig
}) => {
  const [session, setSession] = useState<BatchSession | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  
  const stages = [
    { id: 'download', title: 'Download Geographic Data', icon: DownloadIcon },
    { id: 'simplify1', title: 'Feature Processing', icon: FilterIcon },
    { id: 'simplify2', title: 'Tile Preparation', icon: ProcessIcon },
    { id: 'vectorTiles', title: 'Vector Tile Generation', icon: TileIcon }
  ];
  
  const handleStartBatch = async () => {
    const newSession = await workerAPI.startBatchProcessing(nodeId, initialConfig);
    setSession(newSession);
  };
  
  const handlePauseBatch = async () => {
    if (session) {
      await workerAPI.pauseBatchProcessing(session.id);
    }
  };
  
  const handleResumeBatch = async () => {
    if (session) {
      await workerAPI.resumeBatchProcessing(session.id);
    }
  };
  
  const handleCancelBatch = async () => {
    if (session) {
      await workerAPI.cancelBatchProcessing(session.id);
      setSession(null);
    }
  };
  
  // リアルタイム進捗監視
  useEffect(() => {
    if (!session) return;
    
    const interval = setInterval(async () => {
      const status = await workerAPI.getBatchStatus(session.id);
      setSession(status);
      
      // 現在のアクティブステージを特定
      const active = Object.entries(status.stages)
        .find(([_, stage]) => stage.status === 'running')?.[0];
      setActiveStage(active || null);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [session]);
  
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Batch Processing Pipeline
      </Typography>
      
      {/* ステージ進捗表示 */}
      <Box sx={{ mb: 3 }}>
        {stages.map((stage, index) => (
          <StageProgressCard
            key={stage.id}
            stage={stage}
            status={session?.stages[stage.id]}
            isActive={activeStage === stage.id}
            isCompleted={session?.stages[stage.id]?.status === 'completed'}
          />
        ))}
      </Box>
      
      {/* 全体進捗バー */}
      {session && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress: {session.progress.completed}/{session.progress.total} tasks
          </Typography>
          <LinearProgress
            variant="determinate"
            value={session.progress.percentage}
            sx={{ mt: 1 }}
          />
        </Box>
      )}
      
      {/* 制御ボタン */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {!session && (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleStartBatch}
          >
            Start Processing
          </Button>
        )}
        
        {session && session.status === 'running' && (
          <Button
            variant="outlined"
            startIcon={<PauseIcon />}
            onClick={handlePauseBatch}
          >
            Pause
          </Button>
        )}
        
        {session && session.status === 'paused' && (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleResumeBatch}
          >
            Resume
          </Button>
        )}
        
        {session && ['running', 'paused'].includes(session.status) && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<StopIcon />}
            onClick={handleCancelBatch}
          >
            Cancel
          </Button>
        )}
      </Box>
      
      {/* エラー表示 */}
      {session?.errors.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="body2">
            {session.errors.length} error(s) occurred during processing
          </Typography>
          <details>
            {session.errors.map((error, index) => (
              <Typography key={index} variant="caption" display="block">
                {error.stage}: {error.message}
              </Typography>
            ))}
          </details>
        </Alert>
      )}
    </Paper>
  );
};
```

## 7. データアダプター統合

### 7.1 統一データアクセス層

```typescript
export class UnifiedDataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  // 統一されたノードデータ取得（6分類対応）
  async getNodeData(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<UnifiedNodeData> {
    const plugin = UIPluginRegistry.get(nodeType);
    const treeNode = await this.workerAPI.getTreeNode(nodeId);
    
    if (!plugin.entitySupport.primary.category.includes('Entity')) {
      // Folder等：TreeNodeのみ
      return {
        treeNode,
        entities: {},
        combinedData: this.createCombinedData(treeNode, {})
      };
    }
    
    // エンティティデータを取得
    const entities = await this.loadEntities(nodeId, plugin.entitySupport);
    
    return {
      treeNode,
      entities,
      combinedData: this.createCombinedData(treeNode, entities)
    };
  }
  
  private async loadEntities(
    nodeId: TreeNodeId,
    entitySupport: { primary: EntityUIDefinition; secondary?: EntityUIDefinition[] }
  ): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};
    
    // 主エンティティ
    const primaryData = await this.loadEntityByCategory(
      nodeId,
      entitySupport.primary
    );
    entities.primary = primaryData;
    
    // 副エンティティ
    if (entitySupport.secondary) {
      for (const secondary of entitySupport.secondary) {
        const data = await this.loadEntityByCategory(nodeId, secondary);
        entities[secondary.entityType] = data;
      }
    }
    
    return entities;
  }
  
  private async loadEntityByCategory(
    nodeId: TreeNodeId,
    entityDef: EntityUIDefinition
  ): Promise<any> {
    const { category, entityType } = entityDef;
    
    switch (category) {
      case 'PersistentPeerEntity':
      case 'EphemeralPeerEntity':
        return await this.workerAPI.getEntity(nodeId, entityType);
      
      case 'PersistentGroupEntity':
      case 'EphemeralGroupEntity':
        return await this.workerAPI.getGroupEntities(nodeId, entityType);
      
      case 'PersistentRelationalEntity':
      case 'EphemeralRelationalEntity':
        return await this.workerAPI.getRelatedEntities(nodeId, entityType);
      
      default:
        throw new Error(`Unknown entity category: ${category}`);
    }
  }
  
  // WorkingCopy管理（6分類対応）
  async createWorkingCopy(
    nodeId: TreeNodeId,
    nodeType: TreeNodeType
  ): Promise<string> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    if (!plugin.capabilities.supportsWorkingCopy) {
      throw new Error(`${nodeType} does not support working copies`);
    }
    
    return await this.workerAPI.createWorkingCopy(nodeId);
  }
  
  async commitWorkingCopy(workingCopyId: string): Promise<void> {
    await this.workerAPI.commitWorkingCopy(workingCopyId);
  }
  
  async discardWorkingCopy(workingCopyId: string): Promise<void> {
    await this.workerAPI.discardWorkingCopy(workingCopyId);
    
    // エフェメラルデータの自動クリーンアップ
    await this.workerAPI.cleanupEphemeralData(workingCopyId);
  }
  
  // バッチ処理（Shapesプラグイン用）
  async startBatchProcessing(
    nodeId: TreeNodeId,
    config: any
  ): Promise<BatchSession> {
    return await this.workerAPI.startBatchProcessing(nodeId, config);
  }
  
  async getBatchStatus(sessionId: string): Promise<BatchSession> {
    return await this.workerAPI.getBatchStatus(sessionId);
  }
  
  // RelationalEntity管理
  async addEntityReference(
    entityId: string,
    nodeId: TreeNodeId,
    entityType: string
  ): Promise<void> {
    await this.workerAPI.addEntityReference(entityId, nodeId, entityType);
  }
  
  async removeEntityReference(
    entityId: string,
    nodeId: TreeNodeId,
    entityType: string
  ): Promise<void> {
    await this.workerAPI.removeEntityReference(entityId, nodeId, entityType);
  }
}
```

## 8. 実装ロードマップ

### Phase 1: 基盤システム（4週間）

#### Week 1-2: 6分類エンティティシステム
- [x] **EntityManager階層の実装**
  - PeerEntityManager, GroupEntityManager, RelationalEntityManager
  - EphemeralEntity対応版の実装
  - 自動ライフサイクル管理システム

- [x] **WorkerPluginDefinition拡張**
  - entityClassification対応
  - 複数エンティティ定義サポート
  - 自動登録システム

#### Week 3-4: UI層統一システム
- [x] **UIPluginDefinition標準化**
  - 6分類エンティティ対応
  - 統一されたcapabilities定義
  - マルチステップ・バッチ処理サポート

- [x] **UnifiedDataAdapter実装**
  - 6分類エンティティ対応データアクセス
  - WorkingCopy管理
  - BatchSession管理

### Phase 2: 既存プラグイン改修（3週間）

#### Week 5: Folderプラグイン統一化
- [x] **FolderUIPlugin実装**
  - TreeNodeベースの統一プラグイン化
  - 基本CRUD機能の標準化
  -階層管理機能の保持

#### Week 6: BaseMapプラグイン6分類対応
- [x] **BaseMapEntity → PeerEntity移行**
  - 既存実装の6分類対応
  - WorkingCopy機能の強化
  - UI統一プラグイン化

#### Week 7: StyleMapプラグイン複合エンティティ対応
- [x] **StyleMapEntity + TableMetadataEntity設計**
  - PeerEntity + RelationalEntity複合パターン
  - 6ステップウィザードの統一プラグイン化
  - 参照カウント管理の自動化

### Phase 3: Shapesプラグイン高度実装（4週間）

#### Week 8-9: Shapesエンティティ設計
- [ ] **4分類エンティティ統合**
  - VectorTilesEntity (PersistentGroupEntity)
  - ShapeDataEntity (EphemeralGroupEntity)
  - SourceDataEntity (PersistentRelationalEntity)
  - BatchSessionEntity (EphemeralRelationalEntity)

#### Week 10-11: バッチ処理システム
- [ ] **4段階パイプライン実装**
  - ダウンロード → 簡略化1 → 簡略化2 → ベクタータイル生成
  - 並列処理・進捗管理・エラーハンドリング
  - エフェメラルデータ自動管理

### Phase 4: 統合・最適化（2週間）

#### Week 12: 統合テスト・最適化
- [ ] **プラグイン間連携テスト**
  - 統一API動作確認
  - 6分類エンティティライフサイクル検証
  - パフォーマンス最適化

#### Week 13: ドキュメント・クリーンアップ
- [ ] **包括ドキュメント完成**
  - 開発者ガイド更新
  - APIリファレンス整備
  - サンプルコード作成

## 8. 成功基準と評価指標

### 8.1 技術的成功基準

#### アーキテクチャの一貫性
- ✅ 6分類エンティティシステムの完全実装
- ✅ 自動ライフサイクル管理の動作確認
- ✅ UI層統一プラグインAPIの一貫性
- ✅ Worker層とUI層の適切な責務分離

#### パフォーマンス
- ✅ BaseMap: 地図表示 < 1秒
- ✅ StyleMap: 6ステップ処理 < 30秒
- [ ] Shapes: バッチ処理の並列実行効率
- [ ] メモリ使用量の最適化

#### 拡張性
- ✅ 新プラグインの実装コスト削減（従来比50%減）
- ✅ 6分類エンティティパターンの再利用性
- ✅ マルチステップ処理フレームワークの汎用性

### 8.2 ユーザビリティ指標

#### 操作の一貫性
- ✅ 全プラグインで統一されたCRUD操作
- ✅ 直感的なマルチステップUI
- ✅ エラーメッセージの統一性

#### 学習コスト
- ✅ プラグイン開発者の学習時間短縮
- ✅ エンドユーザーの操作習得時間短縮
- ✅ 包括的なドキュメントの提供

### 8.3 保守性指標

#### コード品質
- ✅ テストカバレッジ > 80%
- ✅ 型安全性の確保
- ✅ 依存関係の最小化

#### 開発効率
- ✅ プラグイン開発時間の短縮
- ✅ バグ修正時間の削減
- ✅ 新機能追加の容易性

## 9. まとめ

この包括設計により、HierarchiDBは以下を実現：

### ✅ 技術的優位性
1. **6分類エンティティシステム**: 適切なライフサイクル管理と自動化
2. **Worker-UI分離**: 各層での最適化戦略の独立実装
3. **統一プラグインAPI**: 一貫した開発体験と保守性
4. **段階的実装**: 既存機能を活用した低リスク移行

### ✅ ユーザー体験
1. **一貫性**: 全プラグインで統一された操作感
2. **直感性**: マルチステップ処理の視覚的フィードバック
3. **効率性**: バッチ処理と並列実行による高速化
4. **信頼性**: 自動エラーハンドリングとデータ保護

### ✅ 開発効率
1. **再利用性**: 6分類パターンによる効率的なプラグイン開発
2. **拡張性**: 新機能追加の容易性と既存機能との互換性
3. **保守性**: 明確な責務分離と自動化による保守コスト削減
4. **品質**: 型安全性とテスタビリティの確保

### ✅ 将来性
1. **スケーラビリティ**: 大規模データと複雑な処理への対応
2. **適応性**: 新しい要件への柔軟な対応
3. **互換性**: 既存システムとの継続的な互換性
4. **革新性**: 先進的な機能の段階的導入

このアーキテクチャにより、HierarchiDBは技術的合理性とユーザー体験の最適化を両立した、次世代の階層データ管理プラットフォームとして発展していくことができます。