# HierarchiDBプラグインアーキテクチャ包括設計：6分類エンティティシステム統合版

## 概要

HierarchiDBのプラグインシステムは、Worker層での技術的最適化とUI層でのUX統一を両立する分離アーキテクチャを採用する。6分類エンティティシステム（Persistent/Ephemeral × Peer/Group/Relational）を基盤として、各層で適切な責務分離を実現する。

## アーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                    HierarchiDB Plugin System                    │
├─────────────────────────────────────────────────────────────────┤
│                      UI Layer (統一プラグイン)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐  │
│  │   Folder     │ │   BaseMap    │ │  StyleMap    │ │  Shapes  │  │
│  │  UI Plugin   │ │  UI Plugin   │ │  UI Plugin   │ │UI Plugin │  │
│  │              │ │              │ │              │ │          │  │
│  │• 作成ダイアログ  │ │• 地図エディター │ │• スタイルエディター│ │• Shape   │  │
│  │• アイコン表示   │ │• プレビュー    │ │• ルール管理     │ │  Editor  │  │
│  │• コンテキスト   │ │• エクスポート  │ │• フィルター     │ │• Multi   │  │
│  │  メニュー      │ │• 権限管理     │ │• プレビュー     │ │  Step    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘  │
│                          ↕ Unified Plugin API                    │
├─────────────────────────────────────────────────────────────────┤
│                   Worker Layer (技術最適化)                       │
│  ┌────────────────┐    ┌───────────────────────────────────────┐  │
│  │   TreeNode     │    │        6分類エンティティシステム         │  │
│  │    System      │    │                                     │  │
│  │                │    │ ┌─────────────┬─────────────┬───────┐ │  │
│  │• treeNodeId    │    │ │ Persistent  │ Ephemeral   │       │ │  │
│  │• parentId      │←─→ │ ├─────────────┼─────────────┤       │ │  │
│  │• treeNodeType  │    │ │StyleMap     │UI State     │ Peer  │ │  │
│  │• name, etc     │    │ │BaseMap      │ViewState    │       │ │  │
│  │                │    │ ├─────────────┼─────────────┤       │ │  │
│  └────────────────┘    │ │VectorTiles  │ShapeData    │ Group │ │  │
│                        │ │Results      │ProcessData  │       │ │  │
│                        │ ├─────────────┼─────────────┤       │ │  │
│                        │ │TableMeta    │SessionRef   │Relat  │ │  │
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
│  │ │• Lifecycle   │ │• Relational  │ │• Multi-Step  │        │  │
│  │ │• Validation  │ │• Metadata    │ │• Ephemeral   │        │  │
│  │ └──────────────┘ └──────────────┘ └──────────────┘        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 6分類エンティティシステムとプラグイン対応

### エンティティ分類マトリックス

```
                    │ Peer        │ Group       │ Relational
────────────────────┼─────────────┼─────────────┼─────────────
Persistent          │ 設定データ   │ 成果物      │ 共有リソース
(CoreDB)            │ StyleMap    │ VectorTiles │ TableMetadata
                    │ BaseMap     │ ShapeResult │ SharedResource
────────────────────┼─────────────┼─────────────┼─────────────
Ephemeral           │ UI状態      │ 中間データ   │ セッション
(EphemeralDB)       │ ViewState   │ ShapeData   │ TempReference
                    │ EditState   │ ProcessData │ SessionShare
```

### プラグインごとのエンティティ利用パターン

#### 1. BaseMapプラグイン（シンプルパターン）

```typescript
export const BaseMapPlugin: WorkerPluginDefinition = {
  nodeType: 'basemap',
  
  // 6分類での位置づけ
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'BaseMapEntity',
      description: '地図設定データ（1:1対応）'
    },
    secondary: []
  },
  
  database: {
    dbName: 'CoreDB',
    tableName: 'basemaps',
    entityManager: 'PeerEntityManager',
    autoLifecycle: true
  },
  
  entityDefinition: {
    interface: 'BaseMapEntity extends PeerEntity',
    properties: ['center', 'zoom', 'style', 'bounds'],
    workingCopySupported: true
  }
};

interface BaseMapEntity extends PeerEntity {
  center: [number, number];
  zoom: number;
  style: string;
  bounds?: [number, number, number, number];
}
```

#### 2. StyleMapプラグイン（複合パターン）

```typescript
export const StyleMapPlugin: WorkerPluginDefinition = {
  nodeType: 'stylemap',
  
  // 6分類での位置づけ（複数エンティティ利用）
  entityClassification: {
    primary: {
      category: 'PersistentPeerEntity',
      entityType: 'StyleMapEntity',
      description: 'スタイル設定（1:1対応）'
    },
    secondary: [{
      category: 'PersistentRelationalEntity',
      entityType: 'TableMetadataEntity',
      description: 'テーブルメタデータ（N:N共有）'
    }]
  },
  
  database: {
    dbName: 'CoreDB',
    tableName: 'stylemaps',
    entityManager: 'PeerEntityManager',
    autoLifecycle: true,
    relations: [{
      entityType: 'TableMetadataEntity',
      manager: 'RelationalEntityManager',
      referenceField: 'tableMetadataId'
    }]
  }
};

interface StyleMapEntity extends PeerEntity {
  name: string;
  filterRules: FilterRule[];
  styleRules: StyleRule[];
  tableMetadataId?: string; // RelationalEntityへの参照
}
```

#### 3. Shapesプラグイン（高度パターン）

```typescript
export const ShapesPlugin: WorkerPluginDefinition = {
  nodeType: '_shapes_buggy',
  
  // 6分類での位置づけ（全分類利用）
  entityClassification: {
    primary: {
      category: 'PersistentGroupEntity',
      entityType: 'VectorTilesEntity',
      description: '成果物のベクタータイル群'
    },
    secondary: [{
      category: 'EphemeralGroupEntity',
      entityType: 'ShapeDataEntity',
      description: '処理中の中間データ'
    }, {
      category: 'PersistentRelationalEntity',
      entityType: 'SourceDataEntity',
      description: '共有ソースデータ'
    }, {
      category: 'EphemeralRelationalEntity',
      entityType: 'ProcessSessionEntity',
      description: '処理セッション情報'
    }]
  },
  
  database: {
    dbName: 'CoreDB', // Persistent entities
    ephemeralDbName: 'EphemeralDB', // Ephemeral entities
    entityManagers: {
      'VectorTilesEntity': 'GroupEntityManager',
      'ShapeDataEntity': 'EphemeralGroupEntityManager',
      'SourceDataEntity': 'RelationalEntityManager',
      'ProcessSessionEntity': 'EphemeralRelationalEntityManager'
    },
    autoLifecycle: true
  },
  
  // マルチステップ処理定義
  multiStepProcess: {
    steps: ['upload', 'validate', 'process', 'generate'],
    ephemeralEntities: ['ShapeDataEntity'],
    persistentEntities: ['VectorTilesEntity'],
    autoCleanup: true
  }
};
```

## Worker層プラグインシステム

### 1. エンティティマネージャーの自動化

```typescript
// packages/core/src/entity-managers/AutoEntityLifecycleManager.ts
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

### 2. プラグイン定義の拡張

```typescript
// packages/core/src/plugins/WorkerPluginDefinition.ts
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
    tableName?: string;
    entityManagers: Record<string, EntityManagerType>;
    autoLifecycle: boolean;
    relations?: RelationDefinition[];
  };
  
  // マルチステップ処理（高度なプラグイン用）
  multiStepProcess?: {
    steps: string[];
    ephemeralEntities: string[];
    persistentEntities: string[];
    autoCleanup: boolean;
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

type EntityManagerType =
  | 'PeerEntityManager'
  | 'GroupEntityManager'
  | 'RelationalEntityManager'
  | 'EphemeralPeerEntityManager'
  | 'EphemeralGroupEntityManager'
  | 'EphemeralRelationalEntityManager';
```

## UI層統一プラグインシステム

### 1. 統一されたUIプラグイン定義

```typescript
// packages/ui-core/src/plugins/UIPluginDefinition.ts
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

### 2. データアダプターの拡張

```typescript
// packages/ui-core/src/plugins/adapters/EntityDataAdapter.ts
export class EntityDataAdapter {
  constructor(private workerAPI: WorkerAPI) {}
  
  // 6分類エンティティに対応したデータ取得
  async getNodeData(nodeId: TreeNodeId, nodeType: TreeNodeType): Promise<UnifiedNodeData> {
    const plugin = UIPluginRegistry.get(nodeType);
    const treeNode = await this.workerAPI.getTreeNode(nodeId);
    
    if (!plugin.dataSource.requiresEntity) {
      // Folder等：TreeNodeのみ
      return this.createUnifiedData(treeNode, null);
    }
    
    // エンティティ付きノード：複数エンティティ対応
    const entities = await this.loadEntities(
      nodeId,
      plugin.entitySupport
    );
    
    return this.createUnifiedData(treeNode, entities);
  }
  
  private async loadEntities(
    nodeId: TreeNodeId,
    entitySupport: { primary: EntityUIDefinition; secondary?: EntityUIDefinition[] }
  ): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};
    
    // 主エンティティ
    entities.primary = await this.workerAPI.getEntity(
      nodeId,
      entitySupport.primary.entityType
    );
    
    // 副エンティティ
    if (entitySupport.secondary) {
      for (const secondary of entitySupport.secondary) {
        entities[secondary.entityType] = await this.workerAPI.getEntity(
          nodeId,
          secondary.entityType
        );
      }
    }
    
    return entities;
  }
  
  // WorkingCopy対応
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
  
  // エフェメラルデータのクリーンアップ
  async cleanupEphemeralData(workingCopyId: string): Promise<void> {
    await this.workerAPI.cleanupEphemeralData(workingCopyId);
  }
}
```

### 3. マルチステップUI対応

```typescript
// packages/ui-core/src/plugins/multi-step/MultiStepDialogManager.ts
export class MultiStepDialogManager {
  // Shapesプラグイン等の複雑なワークフロー対応
  async showMultiStepDialog(
    nodeType: TreeNodeType,
    steps: string[],
    onComplete: (result: any) => void
  ): Promise<void> {
    const plugin = UIPluginRegistry.get(nodeType);
    
    if (!plugin.capabilities.supportsMultiStep) {
      throw new Error(`${nodeType} does not support multi-step operations`);
    }
    
    let workingCopyId: string | null = null;
    let ephemeralData: Record<string, any> = {};
    
    try {
      // ワーキングコピー作成
      workingCopyId = await this.dataAdapter.createWorkingCopy(nodeType);
      
      // ステップごとの処理
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isLastStep = i === steps.length - 1;
        
        const stepResult = await this.executeStep({
          step,
          stepIndex: i,
          isLastStep,
          workingCopyId,
          ephemeralData,
          plugin
        });
        
        // エフェメラルデータを更新
        ephemeralData = { ...ephemeralData, ...stepResult.ephemeralData };
        
        // 最後のステップでない場合は中間データを保存
        if (!isLastStep) {
          await this.workerAPI.saveEphemeralData(
            workingCopyId,
            step,
            ephemeralData
          );
        }
      }
      
      // 成功時：永続化
      const finalResult = await this.workerAPI.commitWorkingCopy(workingCopyId);
      onComplete(finalResult);
      
    } catch (error) {
      // エラー時：クリーンアップ
      if (workingCopyId) {
        await this.dataAdapter.cleanupEphemeralData(workingCopyId);
      }
      throw error;
    }
  }
  
  private async executeStep(params: {
    step: string;
    stepIndex: number;
    isLastStep: boolean;
    workingCopyId: string;
    ephemeralData: Record<string, any>;
    plugin: UIPluginDefinition;
  }): Promise<{ ephemeralData: Record<string, any> }> {
    const { step, isLastStep, ephemeralData, plugin } = params;
    
    // プラグイン固有のステップ処理
    const stepComponent = plugin.components.multiStepDialogs?.[step];
    if (!stepComponent) {
      throw new Error(`Step component not found: ${step}`);
    }
    
    return new Promise((resolve, reject) => {
      const dialog = React.createElement(stepComponent, {
        currentData: ephemeralData,
        isLastStep,
        onNext: (stepData: any) => {
          resolve({ ephemeralData: stepData });
        },
        onCancel: () => {
          reject(new Error('Step cancelled by user'));
        }
      });
      
      // ダイアログを表示
      showModal(dialog);
    });
  }
}
```

## プラグイン実装例

### 1. Folderプラグイン（基本）

```typescript
// packages/ui-core/src/plugins/basic/FolderPlugin.ts
export const FolderUIPlugin: UIPluginDefinition = {
  nodeType: 'folder',
  displayName: 'Folder',
  
  dataSource: {
    requiresEntity: false
  },
  
  entitySupport: {
    primary: {
      category: 'PersistentPeerEntity', // TreeNodeのみだが便宜上
      entityType: 'TreeNode',
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
    supportsRelationalEntities: false
  },
  
  components: {
    icon: FolderIcon,
    createDialog: FolderCreateDialog,
    editDialog: FolderEditDialog
  },
  
  hooks: {
    beforeCreate: async ({ parentId, formData }) => {
      // 重複チェック
      const siblings = await nodeAPI.getChildren(parentId);
      if (siblings.some(s => s.name === formData.name && s.type === 'folder')) {
        return { proceed: false, message: 'Folder name already exists' };
      }
      return { proceed: true };
    }
  },
  
  menu: {
    createOrder: 1,
    group: 'basic'
  }
};
```

### 2. Shapesプラグイン（高度）

```typescript
// packages/plugins/_shapes_buggy/src/ui/ShapesUIPlugin.ts
export const ShapesUIPlugin: UIPluginDefinition = {
  nodeType: '_shapes_buggy',
  displayName: 'Vector Shapes',
  
  dataSource: {
    requiresEntity: true,
    entityTypes: ['VectorTilesEntity', 'ShapeDataEntity', 'SourceDataEntity'],
    primaryEntity: 'VectorTilesEntity'
  },
  
  entitySupport: {
    primary: {
      category: 'PersistentGroupEntity',
      entityType: 'VectorTilesEntity',
      uiFeatures: {
        supportsWorkingCopy: true,
        supportsVersioning: true,
        supportsExport: true,
        supportsPreview: true
      }
    },
    secondary: [{
      category: 'EphemeralGroupEntity',
      entityType: 'ShapeDataEntity',
      uiFeatures: {
        supportsWorkingCopy: false,
        supportsVersioning: false
      }
    }, {
      category: 'PersistentRelationalEntity',
      entityType: 'SourceDataEntity',
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
    supportsEphemeralData: true,
    supportsMultiStep: true,
    supportsBulkOperations: true,
    supportsRelationalEntities: true
  },
  
  components: {
    icon: ShapesIcon,
    createDialog: ShapesMultiStepDialog,
    editDialog: ShapesEditDialog,
    preview: ShapesPreviewComponent,
    multiStepDialogs: {
      'upload': ShapeUploadStep,
      'validate': ShapeValidateStep,
      'process': ShapeProcessStep,
      'generate': ShapeGenerateStep
    }
  },
  
  hooks: {
    onCreateDialog: async ({ parentId, onSubmit }) => {
      // マルチステップダイアログを表示
      await multiStepManager.showMultiStepDialog(
        '_shapes_buggy',
        ['upload', 'validate', 'process', 'generate'],
        onSubmit
      );
    },
    
    onExport: async ({ nodeId, format }) => {
      const entities = await dataAdapter.getNodeData(nodeId, '_shapes_buggy');
      
      if (format === 'geojson') {
        const vectorTiles = entities.entities.primary;
        return await exportVectorTilesAsGeoJSON(vectorTiles);
      }
      
      if (format === 'mvt') {
        const vectorTiles = entities.entities.primary;
        return await exportVectorTilesAsMVT(vectorTiles);
      }
      
      throw new Error(`Unsupported format: ${format}`);
    }
  },
  
  menu: {
    createOrder: 30,
    group: 'advanced'
  }
};
```

## 段階的実装計画

### Phase 1: 6分類エンティティシステム基盤（2週間）
1. エンティティマネージャーの実装
2. 自動ライフサイクル管理システム
3. 基本的なプラグイン定義の拡張

### Phase 2: UI層統一プラグインシステム（3週間）
1. 統一されたUIプラグイン定義
2. データアダプターの実装
3. 動的CRUD操作システム

### Phase 3: 基本プラグインの6分類対応（2週間）
1. Folderプラグインの統一化
2. BaseMapプラグインの6分類対応
3. StyleMapプラグインの複合エンティティ対応

### Phase 4: 高度プラグインの実装（3週間）
1. Shapesプラグインのマルチステップ対応
2. エフェメラルデータ管理
3. リレーショナルエンティティ管理

### Phase 5: 最適化と統合テスト（1週間）
1. パフォーマンス最適化
2. 統合テスト
3. ドキュメント完成

## まとめ

この包括設計により以下を実現：

### ✅ 技術的な利点
1. **Worker層での最適化**: 既存アーキテクチャを活用した高性能実装
2. **UI層での統一性**: 全ノードタイプで一貫したUX
3. **6分類システム**: 適切なライフサイクル管理と最適化
4. **自動化**: エンティティ管理の大部分を自動化

### ✅ 開発効率
1. **段階的実装**: リスクを最小化した段階的な移行
2. **再利用性**: コンポーネントとロジックの高い再利用性
3. **拡張性**: 新しいプラグインの開発が容易
4. **保守性**: 明確な責務分離による保守性向上

### ✅ ユーザー体験
1. **一貫性**: 全ノードタイプで統一された操作感
2. **柔軟性**: プラグインごとのカスタマイズ機能
3. **効率性**: マルチステップ処理とエフェメラルデータ管理
4. **安全性**: 自動的なデータ整合性管理

この設計により、HierarchiDBは技術的合理性とUXの両方を最適化した、拡張性の高いプラグインシステムを実現できます。