# 4.1 プラグインシステム設計

## プラグインアーキテクチャ

### 3層構造
```
Plugin Structure
├── Shared Layer   # 型定義・定数
├── UI Layer       # Reactコンポーネント
└── Worker Layer   # ビジネスロジック・DB操作
```

### プラグイン定義
```typescript
interface PluginDefinition {
  metadata: PluginMetadata;
  ui?: UIPlugin;
  worker?: WorkerPlugin;
  shared: SharedDefinitions;
}

interface PluginMetadata {
  id: string;
  nodeType: TreeNodeType;
  name: string;
  description: string;
  version: string;
  author: string;
  status: 'active' | 'beta' | 'deprecated';
}
```

## プラグイン登録システム

### レジストリ実装
```typescript
class PluginRegistry {
  private plugins = new Map<TreeNodeType, PluginDefinition>();
  
  register(plugin: PluginDefinition): void {
    const { nodeType } = plugin.metadata;
    
    if (this.plugins.has(nodeType)) {
      throw new Error(`Plugin ${nodeType} already registered`);
    }
    
    this.validatePlugin(plugin);
    this.plugins.set(nodeType, plugin);
    this.initializePlugin(plugin);
  }
  
  private validatePlugin(plugin: PluginDefinition): void {
    // 必須フィールドの確認
    if (!plugin.metadata.nodeType) {
      throw new Error('Plugin must have nodeType');
    }
    
    // UI/Worker少なくとも一方必須
    if (!plugin.ui && !plugin.worker) {
      throw new Error('Plugin must have UI or Worker implementation');
    }
  }
}
```

## エンティティハンドラー

### 基底クラス
```typescript
abstract class BaseEntityHandler<T extends BaseEntity> {
  protected abstract table: Table<T, EntityId>;
  
  async createEntity(nodeId: NodeId, data: Partial<T>): Promise<T> {
    const entityId = generateEntityId() as EntityId;
    const entity = {
      id: entityId,
      nodeId,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    } as T;
    
    await this.table.add(entity);
    return entity;
  }
  
  async updateEntity(id: EntityId, updates: Partial<T>): Promise<void> {
    await this.table.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }
  
  async deleteEntity(id: EntityId): Promise<void> {
    await this.table.delete(id);
  }
  
  async getEntity(nodeId: NodeId): Promise<T | undefined> {
    return await this.table.where('nodeId').equals(nodeId).first();
  }
}
```

## ライフサイクルフック

### フック定義
```typescript
interface LifecycleHooks {
  // ノードライフサイクル
  beforeCreate?: (payload: CreateNodePayload) => Promise<void>;
  afterCreate?: (nodeId: NodeId, entity: any) => Promise<void>;
  beforeUpdate?: (nodeId: NodeId, updates: any) => Promise<void>;
  afterUpdate?: (nodeId: NodeId, entity: any) => Promise<void>;
  beforeDelete?: (nodeId: NodeId) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;
  
  // ワーキングコピーライフサイクル
  onWorkingCopyCreate?: (nodeId: NodeId) => Promise<void>;
  onWorkingCopyCommit?: (nodeId: NodeId) => Promise<void>;
  onWorkingCopyDiscard?: (nodeId: NodeId) => Promise<void>;
}
```

### 実行順序
```typescript
class LifecycleManager {
  async executeCreateHooks(
    nodeType: TreeNodeType,
    payload: CreateNodePayload
  ): Promise<NodeId> {
    const plugin = this.registry.getPlugin(nodeType);
    
    // 1. Before Create
    if (plugin?.worker?.lifecycle?.beforeCreate) {
      await plugin.worker.lifecycle.beforeCreate(payload);
    }
    
    // 2. Create Node
    const nodeId = await this.createNode(payload);
    
    // 3. Create Entity
    if (plugin?.worker?.entityHandler) {
      const entity = await plugin.worker.entityHandler.createEntity(
        nodeId,
        payload.entityData || {}
      );
      
      // 4. After Create
      if (plugin?.worker?.lifecycle?.afterCreate) {
        await plugin.worker.lifecycle.afterCreate(nodeId, entity);
      }
    }
    
    return nodeId;
  }
}
```

## UIコンポーネント統合

### ダイアログコンポーネント
```typescript
interface DialogComponentProps {
  mode: 'create' | 'edit';
  nodeId?: NodeId;
  parentNodeId?: NodeId;
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

// プラグインダイアログの動的ロード
function PluginDialog({ nodeType, ...props }: PluginDialogProps) {
  const plugin = usePlugin(nodeType);
  
  if (!plugin?.ui?.components?.DialogComponent) {
    return <DefaultDialog {...props} />;
  }
  
  const DialogComponent = plugin.ui.components.DialogComponent;
  return <DialogComponent {...props} />;
}
```

### パネルコンポーネント
```typescript
// 詳細表示パネル
function PluginPanel({ nodeId }: { nodeId: NodeId }) {
  const node = useNode(nodeId);
  const plugin = usePlugin(node.nodeType);
  
  if (!plugin?.ui?.components?.PanelComponent) {
    return <DefaultPanel node={node} />;
  }
  
  const PanelComponent = plugin.ui.components.PanelComponent;
  return <PanelComponent nodeId={nodeId} />;
}
```

## API拡張

### プラグインAPI定義
```typescript
// Shared層でのAPI定義
interface BaseMapAPI {
  // 標準CRUD
  createEntity(nodeId: NodeId, data: CreateBaseMapData): Promise<BaseMapEntity>;
  updateEntity(nodeId: NodeId, updates: Partial<BaseMapEntity>): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;
  getEntity(nodeId: NodeId): Promise<BaseMapEntity | null>;
  
  // プラグイン固有
  updateMapCenter(nodeId: NodeId, center: [number, number]): Promise<void>;
  updateZoomLevel(nodeId: NodeId, zoom: number): Promise<void>;
  exportMapImage(nodeId: NodeId, format: 'png' | 'jpeg'): Promise<Blob>;
}
```

### Worker実装
```typescript
class BaseMapWorkerAPI implements BaseMapAPI {
  private entityHandler = new BaseMapEntityHandler();
  
  async createEntity(
    nodeId: NodeId, 
    data: CreateBaseMapData
  ): Promise<BaseMapEntity> {
    return await this.entityHandler.createEntity(nodeId, data);
  }
  
  async updateMapCenter(
    nodeId: NodeId, 
    center: [number, number]
  ): Promise<void> {
    const entity = await this.entityHandler.getEntity(nodeId);
    if (!entity) throw new Error('Entity not found');
    
    await this.entityHandler.updateEntity(entity.id, { center });
  }
  
  async exportMapImage(
    nodeId: NodeId, 
    format: 'png' | 'jpeg'
  ): Promise<Blob> {
    // 地図画像生成ロジック
    const entity = await this.entityHandler.getEntity(nodeId);
    return await this.generateMapImage(entity, format);
  }
}
```

## データベース統合

### 動的スキーマ登録
```typescript
class PluginDatabaseManager {
  registerPluginSchema(plugin: WorkerPlugin): void {
    if (!plugin.database) return;
    
    const { tableName, schema, version } = plugin.database;
    
    // CoreDBまたはEphemeralDBに追加
    const targetDB = plugin.persistent ? this.coreDB : this.ephemeralDB;
    
    targetDB.version(version).stores({
      [tableName]: schema
    });
  }
}
```

### マイグレーション
```typescript
interface PluginMigration {
  version: number;
  upgrade: (db: Dexie) => Promise<void>;
  downgrade?: (db: Dexie) => Promise<void>;
}

class PluginMigrationManager {
  async runMigrations(
    plugin: WorkerPlugin,
    fromVersion: number,
    toVersion: number
  ): Promise<void> {
    const migrations = plugin.migrations || [];
    
    for (const migration of migrations) {
      if (migration.version > fromVersion && 
          migration.version <= toVersion) {
        await migration.upgrade(this.db);
      }
    }
  }
}
```

## バリデーション

### 多層バリデーション
```typescript
interface ValidationRules {
  // UI層（即座フィードバック）
  ui?: {
    validateField: (field: string, value: any) => ValidationResult;
    validateForm: (data: any) => ValidationResult;
  };
  
  // Worker層（ビジネスルール）
  worker?: {
    validateEntity: (entity: any) => Promise<ValidationResult>;
    validateUniqueness: (entity: any) => Promise<ValidationResult>;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}
```

## パフォーマンス最適化

### 遅延ロード
```typescript
// プラグインの動的インポート
const pluginLoaders = {
  basemap: () => import('./plugins/basemap'),
  stylemap: () => import('./plugins/stylemap'),
  shape: () => import('./plugins/shape'),
  spreadsheet: () => import('./plugins/spreadsheet'),
  project: () => import('./plugins/project')
};

async function loadPlugin(nodeType: TreeNodeType): Promise<PluginDefinition> {
  const loader = pluginLoaders[nodeType];
  if (!loader) throw new Error(`Unknown plugin: ${nodeType}`);
  
  const module = await loader();
  return module.default;
}
```

### キャッシング
```typescript
class PluginCache {
  private cache = new Map<TreeNodeType, PluginDefinition>();
  
  async getPlugin(nodeType: TreeNodeType): Promise<PluginDefinition> {
    if (this.cache.has(nodeType)) {
      return this.cache.get(nodeType)!;
    }
    
    const plugin = await loadPlugin(nodeType);
    this.cache.set(nodeType, plugin);
    return plugin;
  }
}
```