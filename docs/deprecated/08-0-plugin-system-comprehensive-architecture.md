# HierarchiDBプラグインシステム包括アーキテクチャ：Worker-UI分離設計と6分類エンティティ統合

## 概要

HierarchiDBのプラグインシステムは、Worker層での技術的最適化とUI層でのUX統一を両立する分離アーキテクチャを採用する。6分類エンティティシステム（Persistent/Ephemeral × Peer/Group/Relational）を基盤として、既存のTreeNodeシステムを維持しながら、統一されたプラグイン開発体験を実現する。

## 1. システム全体アーキテクチャ

### 1.1 層構造設計

```
┌─────────────────────────────────────────────────────────────────┐
│                    Plugin System Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                      UI Layer (UX統一)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │   Folder     │ │   BaseMap    │ │  StyleMap    │ │  Shapes  │  │
│  │  UI Plugin   │ │  UI Plugin   │ │  UI Plugin   │ │UI Plugin │  │
│  │              │ │              │ │              │ │          │  │
│  │• 統一CRUD    │ │• 地図エディター │ │• 6ステップ     │ │• 4段階    │  │
│  │• フォルダ管理  │ │• プレビュー    │ │  ウィザード    │ │  バッチ   │  │
│  │• 基本操作     │ │• スタイル設定  │ │• リアルタイム   │ │• 進捗管理 │  │
│  │              │ │• エクスポート  │ │  プレビュー    │ │• 並列処理 │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
│                          ↕ Unified Plugin API                    │
├─────────────────────────────────────────────────────────────────┤
│                   Worker Layer (技術最適化)                       │
│  ┌────────────────┐    ┌───────────────────────────────────────┐  │
│  │   TreeNode     │    │        6分類エンティティシステム         │  │
│  │    System      │    │                                     │  │
│  │   (既存維持)    │    │ ┌─────────────┬─────────────┬───────┐ │  │
│  │                │    │ │ Persistent  │ Ephemeral   │       │ │  │
│  │• treeNodeId    │←─→ │ ├─────────────┼─────────────┤       │ │  │
│  │• parentId      │    │ │StyleMap     │WorkingCopy  │ Peer  │ │  │
│  │• treeNodeType  │    │ │BaseMap      │ViewState    │(1:1)  │ │  │
│  │• name, etc     │    │ ├─────────────┼─────────────┤       │ │  │
│  │                │    │ │VectorTiles  │ShapeData    │ Group │ │  │
│  │• 高性能実装     │    │ │BatchResult  │ProcessData  │(1:N)  │ │  │
│  │• 最適化済み     │    │ ├─────────────┼─────────────┤       │ │  │
│  └────────────────┘    │ │TableMeta    │SessionRef   │Relat  │ │  │
│                        │ │SharedRes    │TempShare    │(N:N)  │ │  │
│                        │ └─────────────┴─────────────┴───────┘ │  │
│                        └───────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Plugin Definition System                        │  │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │  │
│  │ │   BaseMap    │ │  StyleMap    │ │   Shapes     │        │  │
│  │ │    Plugin    │ │    Plugin    │ │    Plugin    │        │  │
│  │ │              │ │              │ │              │        │  │
│  │ │• PeerEntity  │ │• 複合エンティティ│ │• 全分類活用   │        │  │
│  │ │• シンプル     │ │• Peer+Relat  │ │• 高度処理    │        │  │
│  │ │• 地図設定     │ │• 6ステップUI  │ │• バッチ処理   │        │  │
│  │ └──────────────┘ └──────────────┘ └──────────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 設計原則

#### Worker層設計原則（技術最適化）
1. **既存システム活用**: TreeNodeシステムをそのまま維持
2. **パフォーマンス重視**: 高速化された既存実装を継続利用
3. **技術的合理性**: データベース設計とインデックス最適化
4. **移行リスク最小化**: 段階的な導入で既存機能を保護

#### UI層設計原則（UX統一）
1. **統一された操作感**: 全プラグインで一貫したCRUD UX
2. **開発効率向上**: プラグイン開発者にとって統一されたAPI
3. **動的機能生成**: メニューとダイアログの自動生成
4. **コンポーネント再利用**: 共通UIコンポーネントの最大活用

## 2. 6分類エンティティシステム詳細

### 2.1 エンティティ分類マトリックス

```
                    │ Peer        │ Group       │ Relational
                    │ (1:1関係)   │ (1:N関係)   │ (N:N関係)
────────────────────┼─────────────┼─────────────┼─────────────
Persistent          │ 設定データ   │ 成果物      │ 共有リソース
(CoreDB)            │ • StyleMap  │ • VectorTiles│ • TableMetadata
永続化データ         │ • BaseMap   │ • ShapeResult│ • SharedResource
                    │ • Settings  │ • BatchOutput│ • CacheIndex
────────────────────┼─────────────┼─────────────┼─────────────
Ephemeral           │ UI状態      │ 中間データ   │ セッション
(EphemeralDB)       │ • ViewState │ • ShapeData │ • TempReference
一時的データ         │ • EditState │ • ProcessData│ • SessionShare
                    │ • UIPrefs   │ • WorkingSet │ • BatchSession
```

### 2.2 エンティティ関係パターン

#### PeerEntity（1:1関係）
```typescript
interface PeerEntity extends BaseEntity {
  nodeId: TreeNodeId; // TreeNodeとの1:1対応
  // TreeNodeのライフサイクルと同期
  // TreeNode削除時に自動削除
}

// 例：BaseMapEntity
interface BaseMapEntity extends PeerEntity {
  center: [number, number];
  zoom: number;
  style: string;
}
```

#### GroupEntity（1:N関係）
```typescript
interface GroupEntity extends BaseEntity {
  nodeId: TreeNodeId; // 親TreeNode
  groupId: string;    // グループ識別子
  sortOrder: number;  // 順序管理
  // 1つのTreeNodeに複数のエンティティが紐づく
}

// 例：VectorTilesEntity
interface VectorTilesEntity extends GroupEntity {
  zoom: number;
  x: number;
  y: number;
  data: Uint8Array;
}
```

#### RelationalEntity（N:N関係）
```typescript
interface RelationalEntity extends BaseEntity {
  references: TreeNodeId[]; // 参照先TreeNode群
  referenceCount: number;   // 参照カウント
  lastAccessedAt: number;   // 最終アクセス時刻
  // 参照カウントによる自動ライフサイクル管理
}

// 例：TableMetadataEntity
interface TableMetadataEntity extends RelationalEntity {
  filename: string;
  columns: string[];
  checksum: string;
}
```

## 3. Worker層プラグインシステム

### 3.1 プラグイン定義の拡張

```typescript
export interface WorkerPluginDefinition<TEntities = any> {
  // 基本情報
  nodeType: TreeNodeType;
  name: string;
  version: string;
  
  // 6分類エンティティ定義
  entityClassification: {
    primary: EntityClassification;
    secondary?: EntityClassification[];
  };
  
  // データベース設定（自動化）
  database: {
    dbName: 'CoreDB' | 'EphemeralDB';
    ephemeralDbName?: 'EphemeralDB';
    entityManagers: Record<string, EntityManagerType>;
    autoLifecycle: boolean;
    relations?: RelationDefinition[];
  };
  
  // エンティティハンドラー（簡略化）
  entityHandler: EntityHandler<TEntities>;
  
  // ライフサイクルフック（簡略化）
  lifecycle?: LifecycleHooks;
  
  // バリデーション
  validation?: ValidationRules;
}

interface EntityClassification {
  category: EntityCategory;
  entityType: string;
  manager: EntityManagerType;
  description: string;
}

type EntityCategory = 
  | 'PersistentPeerEntity'
  | 'PersistentGroupEntity'
  | 'PersistentRelationalEntity'
  | 'EphemeralPeerEntity'
  | 'EphemeralGroupEntity'
  | 'EphemeralRelationalEntity';
```

### 3.2 自動ライフサイクル管理

```typescript
export class AutoEntityLifecycleManager {
  private managers = new Map<string, EntityManager>();
  
  constructor() {
    // 6分類に対応したマネージャーを登録
    this.managers.set('PeerEntityManager', new PeerEntityManager());
    this.managers.set('GroupEntityManager', new GroupEntityManager());
    this.managers.set('RelationalEntityManager', new RelationalEntityManager());
    this.managers.set('EphemeralPeerEntityManager', new EphemeralPeerEntityManager());
    this.managers.set('EphemeralGroupEntityManager', new EphemeralGroupEntityManager());
    this.managers.set('EphemeralRelationalEntityManager', new EphemeralRelationalEntityManager());
  }
  
  // プラグイン登録時に自動的にライフサイクル管理を設定
  registerPlugin(plugin: WorkerPluginDefinition) {
    const { entityClassification } = plugin;
    
    // 主エンティティのライフサイクル設定
    this.setupEntityLifecycle(
      plugin.nodeType,
      entityClassification.primary
    );
    
    // 副エンティティのライフサイクル設定
    entityClassification.secondary?.forEach(entity => {
      this.setupEntityLifecycle(
        plugin.nodeType,
        entity
      );
    });
  }
  
  private setupEntityLifecycle(
    nodeType: TreeNodeType,
    entity: EntityClassification
  ) {
    const manager = this.managers.get(entity.manager);
    if (!manager) {
      throw new Error(`Unknown entity manager: ${entity.manager}`);
    }
    
    // TreeNode削除時の自動クリーンアップを設定
    TreeNodeLifecycleHooks.beforeDelete.add(async (nodeId) => {
      await manager.cleanup(nodeId, entity.entityType);
    });
    
    // WorkingCopy削除時の自動クリーンアップを設定（Ephemeralエンティティ）
    if (entity.category.startsWith('Ephemeral')) {
      WorkingCopyLifecycleHooks.afterDiscard.add(async (workingCopyId) => {
        await manager.cleanupByWorkingCopy(workingCopyId, entity.entityType);
      });
    }
  }
}
```

### 3.3 具体的なプラグイン実装例

#### BaseMapプラグイン（シンプルパターン）

```typescript
export const BaseMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'basemap',
  name: 'BaseMap',
  version: '1.0.0',
  
  // 6分類での位置づけ
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      manager: 'PeerEntityManager',
      description: '地図設定データ（1:1対応）'
    }
  },
  
  database: {
    dbName: 'CoreDB',
    entityManagers: {
      'BaseMapEntity': 'PeerEntityManager'
    },
    autoLifecycle: true
  },
  
  entityHandler: new BaseMapHandler(),
  
  lifecycle: {
    beforeCreate: async (parentId, data) => {
      // 座標検証
      if (data.center) {
        const [lng, lat] = data.center;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          throw new Error('Invalid coordinates');
        }
      }
    }
  }
};
```

#### StyleMapプラグイン（複合パターン）

```typescript
export const StyleMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'stylemap',
  name: 'StyleMap',
  version: '1.0.0',
  
  // 6分類での位置づけ（複数エンティティ利用）
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      manager: 'PeerEntityManager',
      description: 'スタイル設定（1:1対応）'
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager',
      description: 'テーブルメタデータ（N:N共有）'
    }]
  },
  
  database: {
    dbName: 'CoreDB',
    entityManagers: {
      'StyleMapEntity': 'PeerEntityManager',
      'TableMetadataEntity': 'RelationalEntityManager'
    },
    autoLifecycle: true,
    relations: [{
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager',
      referenceField: 'tableMetadataId'
    }]
  },
  
  entityHandler: new StyleMapHandler()
};
```

#### Shapesプラグイン（高度パターン）

```typescript
export const ShapesWorkerPlugin: WorkerPluginDefinition = {
  nodeType: '_shapes_buggy',
  name: 'Shapes',
  version: '1.0.0',
  
  // 6分類での位置づけ（全分類利用）
  entityClassification: {
    primary: {
      category: 'PersistentGroupEntity',
      entityType: 'VectorTilesEntity',
      manager: 'GroupEntityManager',
      description: '成果物のベクタータイル群'
    },
    secondary: [{
      category: 'EphemeralGroupEntity',
      entityType: 'ShapeDataEntity',
      manager: 'EphemeralGroupEntityManager',
      description: '処理中の中間データ'
    }, {
      category: 'PersistentRelationalEntity',
      entityType: 'SourceDataEntity',
      manager: 'RelationalEntityManager',
      description: '共有ソースデータ'
    }, {
      category: 'EphemeralRelationalEntity',
      entityType: 'BatchSessionEntity',
      manager: 'EphemeralRelationalEntityManager',
      description: '処理セッション情報'
    }]
  },
  
  database: {
    dbName: 'CoreDB',
    ephemeralDbName: 'EphemeralDB',
    entityManagers: {
      'VectorTilesEntity': 'GroupEntityManager',
      'ShapeDataEntity': 'EphemeralGroupEntityManager',
      'SourceDataEntity': 'RelationalEntityManager',
      'BatchSessionEntity': 'EphemeralRelationalEntityManager'
    },
    autoLifecycle: true
  },
  
  // マルチステップ処理定義
  multiStepProcess: {
    steps: ['download', 'simplify1', 'simplify2', 'vectorTiles'],
    ephemeralEntities: ['ShapeDataEntity'],
    persistentEntities: ['VectorTilesEntity'],
    autoCleanup: true
  },
  
  entityHandler: new ShapesHandler()
};
```

## 4. UI層統一プラグインシステム

### 4.1 統一されたUIプラグイン定義

```typescript
export interface UIPluginDefinition {
  // 基本情報
  nodeType: TreeNodeType;
  displayName: string;
  
  // データソース定義（Worker層との連携）
  dataSource: {
    requiresEntity: boolean;
    entityTypes?: string[];
    primaryEntity?: string;
  };
  
  // 6分類システム対応
  entitySupport: {
    primary: EntityUIDefinition;
    secondary?: EntityUIDefinition[];
  };
  
  // CRUD機能定義
  capabilities: PluginCapabilities;
  
  // UIコンポーネント
  components: UIComponentSet;
  
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

interface PluginCapabilities {
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
}
```

### 4.2 UI層アクションフック（CRUDベース）

```typescript
export interface UIActionHooks {
  // Create アクションフック
  beforeShowCreateDialog?: (params: {
    parentNodeId: TreeNodeId;
    nodeType: TreeNodeType;
    context: UIContext;
  }) => Promise<{
    proceed: boolean;
    modifiedParams?: any;
    message?: string;
  }>;

  onShowCreateDialog?: (params: {
    parentNodeId: TreeNodeId;
    nodeType: TreeNodeType;
    defaultValues?: any;
  }) => Promise<React.ComponentType<CreateDialogProps> | null>;

  afterCreate?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    parentNodeId: TreeNodeId;
  }) => Promise<{
    navigateTo?: TreeNodeId;
    showMessage?: string;
    refreshNodes?: TreeNodeId[];
  }>;

  // Read アクションフック
  onRenderNode?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    viewType: 'table' | 'detail' | 'preview';
  }) => Promise<React.ComponentType<NodeRendererProps> | null>;

  onFormatNodeData?: (params: {
    entity: any;
    field: string;
    viewType: 'table' | 'detail' | 'preview';
  }) => Promise<string | React.ReactNode>;

  // Update アクションフック
  beforeStartEdit?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    editMode: 'inline' | 'dialog' | 'panel';
  }) => Promise<{
    proceed: boolean;
    readOnlyFields?: string[];
    editableFields?: string[];
  }>;

  onShowEditDialog?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    editMode: 'inline' | 'dialog' | 'panel';
  }) => Promise<React.ComponentType<EditDialogProps> | null>;

  afterUpdate?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    changedFields: string[];
  }) => Promise<{
    refreshNodes?: TreeNodeId[];
    showMessage?: string;
    nextAction?: string;
  }>;

  // Delete アクションフック
  beforeDelete?: (params: {
    nodeIds: TreeNodeId[];
    entities: any[];
    hasChildren: boolean;
  }) => Promise<{
    proceed: boolean;
    confirmMessage?: string;
    showChildrenWarning?: boolean;
  }>;

  afterDelete?: (params: {
    deletedNodeIds: TreeNodeId[];
    parentId?: TreeNodeId;
  }) => Promise<{
    navigateTo?: TreeNodeId;
    showMessage?: string;
    refreshNodes?: TreeNodeId[];
  }>;

  // その他のアクションフック
  onContextMenu?: (params: {
    nodeId: TreeNodeId;
    entity: any;
    mousePosition: { x: number; y: number };
  }) => Promise<ContextMenuItem[]>;

  onExport?: (params: {
    nodeIds: TreeNodeId[];
    format: string;
  }) => Promise<Blob>;
}
```

### 4.3 データアダプター（Worker側との橋渡し）

```typescript
export class NodeDataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  // 統一されたノードデータ取得
  async getNodeData(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<UnifiedNodeData> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    // 1. TreeNodeデータを取得（全ノード共通）
    const treeNode = await this.workerAPI.getTreeNode(nodeId);
    
    if (!plugin.dataSource.requiresEntity) {
      // フォルダなど：TreeNodeのみ
      return {
        treeNode,
        entities: {},
        combinedData: {
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          createdAt: treeNode.createdAt,
          updatedAt: treeNode.updatedAt
        }
      };
    } else {
      // BaseMapなど：TreeNode + Entity
      const entities = await this.loadEntities(nodeId, plugin.entitySupport);
      return {
        treeNode,
        entities,
        combinedData: {
          // TreeNodeの基本情報
          id: treeNode.treeNodeId,
          name: treeNode.name,
          type: treeNode.treeNodeType,
          parentId: treeNode.parentId,
          
          // Entityの詳細情報
          ...entities.primary,
          
          // 統合されたタイムスタンプ
          createdAt: treeNode.createdAt,
          updatedAt: Math.max(treeNode.updatedAt, entities.primary?.updatedAt || 0)
        }
      };
    }
  }
  
  private async loadEntities(
    nodeId: TreeNodeId,
    entitySupport: { primary: EntityUIDefinition; secondary?: EntityUIDefinition[] }
  ): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};
    
    // 主エンティティ
    entities.primary = await this.loadEntityByCategory(
      nodeId,
      entitySupport.primary
    );
    
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
}
```

## 5. コンテナ型とドキュメント型の設計

### 5.1 プラグインタイプ分類

#### コンテナ型プラグイン（フォルダベース）
- **特徴**: 子ノードを持つ、階層管理、権限管理
- **例**: Folder, Project
- **エンティティ**: PeerEntity（設定保持）
- **UI**: 階層表示、一括操作、権限設定

```typescript
export abstract class ContainerPluginBase<TEntity extends PeerEntity> {
  readonly capabilities = {
    canHaveChildren: true,
    isContainer: true,
    supportsBulkOperations: true,
    supportsSearch: true
  };
  
  // 子ノード管理
  async getChildren(nodeId: TreeNodeId): Promise<TreeNode[]> {
    return await this.coreDB.getChildren(nodeId);
  }
  
  // 権限管理（コンテナ型で重要）
  async checkPermissions(nodeId: TreeNodeId, action: string, userId: string): Promise<boolean> {
    const entity = await this.get(nodeId);
    return await this.validateAccess(entity, action, userId);
  }
  
  // 一括操作
  async bulkOperation(nodeIds: TreeNodeId[], operation: string): Promise<void> {
    // コンテナ型特有の一括処理
  }
}
```

#### ドキュメント型プラグイン（ドキュメントベース）
- **特徴**: 単一エンティティ、WorkingCopy、バージョン管理、エクスポート
- **例**: BaseMap, StyleMap, Shapes
- **エンティティ**: PeerEntity, GroupEntity, RelationalEntity
- **UI**: 編集ダイアログ、プレビュー、エクスポート

```typescript
export abstract class DocumentPluginBase<TEntity extends PeerEntity> {
  readonly capabilities = {
    canHaveChildren: false,
    isContainer: false,
    supportsWorkingCopy: true,
    supportsVersioning: true,
    supportsExport: true
  };
  
  // Working Copy 管理
  async createWorkingCopy(nodeId: TreeNodeId): Promise<TEntity & WorkingCopyMixin> {
    const entity = await this.get(nodeId);
    return {
      ...entity,
      workingCopyId: generateId(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false
    };
  }
  
  // バージョン管理
  async getVersionHistory(nodeId: TreeNodeId): Promise<VersionInfo[]> {
    return await this.versionDB.getVersions(nodeId);
  }
  
  // エクスポート
  async export(nodeId: TreeNodeId, format: string): Promise<Blob> {
    const entity = await this.get(nodeId);
    return await this.formatExport(entity, format);
  }
}
```

### 5.2 UI層での動的対応

```typescript
export class PluginTypeDetector {
  static isContainerType(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.isContainer || false;
  }
  
  static canHaveChildren(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.canHaveChildren || false;
  }
  
  static supportsWorkingCopy(nodeType: TreeNodeType): boolean {
    const plugin = UIPluginRegistry.get(nodeType);
    return plugin?.capabilities?.supportsWorkingCopy || false;
  }
}

// 動的メニュー生成
export const useDynamicCreateMenu = (parentNodeId: TreeNodeId) => {
  const [menuItems, setMenuItems] = useState<CreateMenuItem[]>([]);
  
  useEffect(() => {
    async function loadMenuItems() {
      const parentNode = await workerAPI.getNode(parentNodeId);
      const parentPlugin = UIPluginRegistry.get(parentNode.type);
      
      if (!parentPlugin.capabilities.canHaveChildren) {
        setMenuItems([]); // 子を持てないノードの場合は空
        return;
      }
      
      // 親ノードが許可する子ノードタイプを取得
      const allowedTypes = await workerAPI.getAllowedChildTypes(parentNode.type);
      
      // コンテナ型とドキュメント型で分けてメニューを構築
      const containerItems = allowedTypes
        .filter(type => PluginTypeDetector.isContainerType(type))
        .map(type => createMenuItem(type, 'container'));
        
      const documentItems = allowedTypes
        .filter(type => !PluginTypeDetector.isContainerType(type))
        .map(type => createMenuItem(type, 'document'));
      
      // グループ分けしてメニューに表示
      const items = [
        ...containerItems,
        ...(containerItems.length > 0 && documentItems.length > 0 ? [{ type: 'divider' }] : []),
        ...documentItems
      ];
      
      setMenuItems(items);
    }
    
    loadMenuItems();
  }, [parentNodeId]);
  
  return menuItems;
};
```

## 6. マルチステップ処理システム

### 6.1 StyleMapの6ステップウィザード

StyleMapプラグインは、CSVデータインポートのための6ステップウィザードを提供：

1. **Step1: Name & Description** - 基本情報入力
2. **Step2: File Upload** - ファイルアップロードとプレビュー
3. **Step3: Filter Settings** - データフィルタリング設定
4. **Step4: Column Selection** - キー列・値列選択とマッピング
5. **Step5: Color Settings** - カラールールとスタイル設定
6. **Step6: Preview & Confirm** - 最終プレビューと確認

```typescript
export const StyleMapMultiStepDialog: React.FC<MultiStepDialogProps> = ({
  onComplete,
  onCancel
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<StyleMapFormData>(getDefaultFormData());
  
  const steps = [
    { title: 'Name & Description', component: Step1NameDescription },
    { title: 'Upload Data File', component: Step2FileUpload },
    { title: 'Filter Settings', component: Step3FilterSettings },
    { title: 'Column Selection', component: Step4ColumnSelection },
    { title: 'Color Settings', component: Step5ColorSettings },
    { title: 'PreviewStep & Confirm', component: Step6Preview }
  ];
  
  const handleComplete = async () => {
    // StyleMapエンティティ + TableMetadataエンティティの作成
    const entity = await workerAPI.createNode('stylemap', formData);
    onComplete(entity);
  };
  
  return (
    <MultiStepWizard
      steps={steps}
      activeStep={activeStep}
      formData={formData}
      onFormDataChange={setFormData}
      onNext={() => setActiveStep(prev => prev + 1)}
      onBack={() => setActiveStep(prev => prev - 1)}
      onComplete={handleComplete}
      onCancel={onCancel}
      validateStep={(step, data) => validateStyleMapStep(step, data)}
    />
  );
};
```

### 6.2 Shapesの4段階バッチ処理

Shapesプラグインは、地理データ処理のための4段階バッチ処理を提供：

1. **Download Stage** - 地理データのダウンロード（並列実行）
2. **Simplify1 Stage** - フィーチャー処理とフィルタリング
3. **Simplify2 Stage** - タイル前処理と簡略化
4. **VectorTiles Stage** - ベクタータイル生成

```typescript
export const ShapesBatchProcessor: React.FC<BatchProcessorProps> = ({
  nodeId,
  config
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
    const newSession = await workerAPI.startBatchProcessing(nodeId, config);
    setSession(newSession);
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
    <BatchProcessingPanel
      session={session}
      stages={stages}
      activeStage={activeStage}
      onStart={handleStartBatch}
      onPause={() => workerAPI.pauseBatchProcessing(session!.id)}
      onResume={() => workerAPI.resumeBatchProcessing(session!.id)}
      onCancel={() => workerAPI.cancelBatchProcessing(session!.id)}
    />
  );
};
```

## 7. プラグイン実装パターン

### 7.1 基本パターン（Folder）

最もシンプルなプラグイン実装：

```typescript
// Worker層
export const FolderWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'folder',
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'TreeNode', // TreeNodeのみ使用
      manager: 'PeerEntityManager'
    }
  },
  database: { dbName: 'CoreDB', autoLifecycle: true }
};

// UI層
export const FolderUIPlugin: UIPluginDefinition = {
  nodeType: 'folder',
  capabilities: {
    canHaveChildren: true,
    supportsWorkingCopy: false,
    supportsMultiStep: false
  },
  components: { icon: FolderIcon, editDialog: FolderEditDialog }
};
```

### 7.2 中級パターン（BaseMap）

PeerEntityを利用したシンプルなドキュメント型：

```typescript
// Worker層
export const BaseMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'basemap',
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      manager: 'PeerEntityManager'
    }
  },
  database: { dbName: 'CoreDB', autoLifecycle: true }
};

// UI層
export const BaseMapUIPlugin: UIPluginDefinition = {
  nodeType: 'basemap',
  capabilities: {
    canHaveChildren: false,
    supportsWorkingCopy: true,
    supportsExport: true
  },
  components: {
    icon: MapIcon,
    createDialog: BaseMapCreateDialog,
    editDialog: BaseMapEditDialog,
    preview: MapPreviewComponent
  }
};
```

### 7.3 高級パターン（StyleMap）

複合エンティティを利用したマルチステップ処理：

```typescript
// Worker層
export const StyleMapWorkerPlugin: WorkerPluginDefinition = {
  nodeType: 'stylemap',
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      manager: 'PeerEntityManager'
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager'
    }]
  },
  database: { dbName: 'CoreDB', autoLifecycle: true }
};

// UI層
export const StyleMapUIPlugin: UIPluginDefinition = {
  nodeType: 'stylemap',
  capabilities: {
    supportsWorkingCopy: true,
    supportsMultiStep: true,
    supportsRelationalEntities: true
  },
  components: {
    icon: StyleIcon,
    multiStepDialog: StyleMapImporter
  }
};
```

### 7.4 最高級パターン（Shapes）

全分類エンティティを活用した高度なバッチ処理：

```typescript
// Worker層
export const ShapesWorkerPlugin: WorkerPluginDefinition = {
  nodeType: '_shapes_buggy',
  entityClassification: {
    primary: {
      category: 'PersistentGroupEntity',
      entityType: 'VectorTilesEntity',
      manager: 'GroupEntityManager'
    },
    secondary: [{
      category: 'EphemeralGroupEntity',
      entityType: 'ShapeDataEntity',
      manager: 'EphemeralGroupEntityManager'
    }, {
      category: 'PersistentRelationalEntity',
      entityType: 'SourceDataEntity',
      manager: 'RelationalEntityManager'
    }, {
      category: 'EphemeralRelationalEntity',
      entityType: 'BatchSessionEntity',
      manager: 'EphemeralRelationalEntityManager'
    }]
  },
  multiStepProcess: {
    steps: ['download', 'simplify1', 'simplify2', 'vectorTiles'],
    autoCleanup: true
  }
};

// UI層
export const ShapesUIPlugin: UIPluginDefinition = {
  nodeType: '_shapes_buggy',
  capabilities: {
    supportsWorkingCopy: true,
    supportsEphemeralData: true,
    supportsMultiStep: true,
    supportsBulkOperations: true,
    supportsRelationalEntities: true,
    supportsGroupOperations: true
  },
  components: {
    icon: ShapesIcon,
    multiStepDialog: ShapesMultiStepDialog,
    batchProcessor: ShapesBatchProcessor
  }
};
```

## 8. 段階的実装戦略

### Phase 1: 基盤システム構築（4週間）
1. **6分類エンティティシステム**: EntityManager階層とライフサイクル管理
2. **UI層統一フレームワーク**: UIPluginDefinitionと統一API
3. **既存プラグイン移行**: Folderの統一プラグイン化

### Phase 2: 中級プラグイン対応（3週間）
1. **BaseMapプラグイン**: PeerEntity対応と統一UI
2. **基本機能テスト**: CRUD操作とWorkingCopy管理
3. **パフォーマンス最適化**: データアクセス層の改善

### Phase 3: 高級プラグイン対応（4週間）
1. **StyleMapプラグイン**: 複合エンティティと6ステップウィザード
2. **RelationalEntity管理**: 参照カウントと自動クリーンアップ
3. **マルチステップフレームワーク**: 汎用的なウィザードシステム

### Phase 4: 最高級プラグイン実装（5週間）
1. **Shapesプラグイン**: 全分類エンティティとバッチ処理
2. **並列処理システム**: Worker活用とメモリ管理
3. **エフェメラルデータ管理**: 自動クリーンアップとセッション管理

### Phase 5: 統合・最適化（2週間）
1. **プラグイン間連携**: 統一APIの完全動作確認
2. **パフォーマンス最適化**: メモリ使用量とレスポンス時間改善
3. **ドキュメント整備**: 開発者ガイドと実装例の完成

## 9. 利点とメリット

### 9.1 技術的利点

#### Worker層（技術最適化）
- ✅ **既存システム活用**: TreeNodeの高性能実装をそのまま維持
- ✅ **段階的移行**: 低リスクでの新機能追加
- ✅ **パフォーマンス維持**: 最適化されたデータベースアクセス
- ✅ **自動ライフサイクル**: エンティティ管理の自動化

#### UI層（UX統一）
- ✅ **一貫した操作感**: 全プラグインで統一されたCRUD UX
- ✅ **開発効率向上**: 統一APIによる学習コスト削減
- ✅ **動的機能生成**: メニューとダイアログの自動生成
- ✅ **コンポーネント再利用**: 共通UIパターンの活用

### 9.2 開発効率

#### プラグイン開発者
- ✅ **学習コスト削減**: 統一されたAPI設計
- ✅ **実装時間短縮**: テンプレートとパターンの提供
- ✅ **品質向上**: 自動テストとバリデーション
- ✅ **保守性向上**: 明確な責務分離

#### システム保守
- ✅ **バグ修正効率**: 層別の独立した修正
- ✅ **機能追加容易性**: プラグインパターンの再利用
- ✅ **テスト効率**: 層別・プラグイン別のテスト戦略
- ✅ **ドキュメント整備**: 包括的な開発ガイド

### 9.3 ユーザー体験

#### エンドユーザー
- ✅ **操作の一貫性**: 全プラグインで同じ操作感
- ✅ **学習効率**: 一度覚えた操作の汎用性
- ✅ **高度機能**: マルチステップとバッチ処理
- ✅ **信頼性**: 自動エラーハンドリングとデータ保護

#### プラグイン利用者
- ✅ **機能豊富性**: 段階的な機能提供（基本→高級→最高級）
- ✅ **拡張性**: 新しいプラグインの容易な追加
- ✅ **互換性**: 既存データとの継続的な互換性
- ✅ **カスタマイズ性**: プラグインごとの柔軟な設定

## 10. まとめ

HierarchiDBの包括プラグインアーキテクチャは、以下の核心価値を実現：

### ✅ **アーキテクチャの合理性**
1. **Worker層**: 既存の高性能システムを活用した技術最適化
2. **UI層**: 統一されたプラグインAPIによるUX最適化
3. **6分類システム**: 適切なエンティティライフサイクル管理
4. **分離設計**: 各層での独立した最適化戦略

### ✅ **開発体験の向上**
1. **統一API**: 一貫したプラグイン開発体験
2. **段階的複雑性**: 基本→中級→高級→最高級のパターン提供
3. **自動化**: ライフサイクル管理とUIコンポーネント生成
4. **再利用性**: プラグインパターンとコンポーネントの活用

### ✅ **ユーザー体験の最適化**
1. **一貫性**: 全プラグインで統一された操作感
2. **高度機能**: マルチステップ処理とバッチ実行
3. **信頼性**: 自動エラーハンドリングとデータ保護
4. **効率性**: 並列処理とメモリ最適化

### ✅ **将来性の確保**
1. **拡張性**: 新プラグインの容易な追加
2. **互換性**: 既存システムとの継続的互換性
3. **保守性**: 明確な責務分離と自動化
4. **革新性**: 先進的機能の段階的導入

この設計により、HierarchiDBは技術的合理性とユーザー体験を両立した、次世代の階層データ管理プラットフォームとして継続的に発展していくことができます。