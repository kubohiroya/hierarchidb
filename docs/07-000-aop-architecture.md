# 7. AOP (Aspect-Oriented Programming) アーキテクチャ仕様

## 7.1 概要

本ドキュメントでは、hierarchidbプロジェクトにおけるAOP方式の導入について、eria-cartographプロジェクトの実装を参考に、詳細な仕様と設計を定義する。

### 7.1.1 目的

- ノードタイプごとの振る舞いを、コア機能から分離して管理
- ノードのライフサイクルに応じた拡張ポイントの提供
- プラグイン形式での機能拡張を可能にする
- クロスカッティングな関心事の統一的な処理

### 7.1.2 主要コンセプト

- **ノードタイプ定義レジストリ**: ノードタイプごとの定義を登録・管理
- **ライフサイクルフック**: ノードの作成・更新・削除時の拡張ポイント
- **エンティティ管理**: ノードに紐づくエンティティとサブエンティティの管理
- **ワーキングコピーパターン**: 安全な編集のためのCopy-on-Write実装

## 7.2 ノードタイプ定義システム

### 7.2.1 ノードタイプ定義インターフェース

```typescript
// packages/core/src/types/nodeDefinition.ts

// 基本的なエンティティインターフェース
export interface BaseEntity {
  nodeId: TreeNodeId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

// サブエンティティの基本インターフェース
export interface BaseSubEntity {
  id: string;
  parentNodeId: TreeNodeId;
  type: string;
}

// ワーキングコピーの基本インターフェース
export interface BaseWorkingCopy extends BaseEntity {
  workingCopyId: UUID;
  workingCopyOf: TreeNodeId;
  copiedAt: Timestamp;
  isDirty: boolean;
}

// UIコンポーネントのプロパティ
export interface NodeDialogProps<TEntity extends BaseEntity = BaseEntity> {
  nodeId?: TreeNodeId;
  nodeType: TreeNodeType;
  onClose: () => void;
  onSave?: (data: Partial<TEntity>) => Promise<void>;
}

export interface NodePanelProps {
  nodeId: TreeNodeId;
  readonly?: boolean;
}

export interface NodeFormProps<TEntity extends BaseEntity = BaseEntity> {
  entity: TEntity;
  onChange: (entity: Partial<TEntity>) => void;
  errors?: ValidationErrors<TEntity>;
}

// バリデーションエラーの型
export type ValidationErrors<T> = {
  [K in keyof T]?: string;
};

// データベーススキーマ定義
export interface DatabaseSchema {
  [storeName: string]: string; // Dexie schema string
}

// バリデーション結果の型
export type ValidationResult = 
  | { valid: true }
  | { valid: false; message: string };

// バリデーションルール
export interface ValidationRule<TEntity extends BaseEntity = BaseEntity> {
  name: string;
  validate: (entity: TEntity) => ValidationResult | Promise<ValidationResult>;
  getMessage?: (entity: TEntity) => string;
}

// 共通のAPIメソッドの型
export type APIMethodArgs = readonly [TreeNodeId, ...any[]];
export type APIMethodReturn = 
  | BaseEntity 
  | BaseEntity[] 
  | string 
  | number 
  | boolean 
  | void
  | { [key: string]: string | number | boolean };

// Worker API拡張メソッド
export type WorkerAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs, 
  TReturn extends APIMethodReturn = APIMethodReturn
> = (...args: TArgs) => Promise<TReturn>;

export interface WorkerAPIExtensions {
  [methodName: string]: WorkerAPIMethod;
}

// 型安全なWorker API拡張
export interface TypedWorkerAPIExtensions<T extends Record<string, WorkerAPIMethod>> {
  methods: T;
}

// Client API拡張メソッド  
export type ClientAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs, 
  TReturn extends APIMethodReturn = APIMethodReturn
> = (...args: TArgs) => TReturn;

export interface ClientAPIExtensions {
  [methodName: string]: ClientAPIMethod;
}

// 型安全なClient API拡張
export interface TypedClientAPIExtensions<T extends Record<string, ClientAPIMethod>> {
  methods: T;
}

export interface NodeTypeDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> {
  // 基本情報
  readonly nodeType: TreeNodeType;
  readonly name: string;
  readonly displayName: string;
  readonly icon?: string;
  readonly color?: string;
  
  // データベース設定
  readonly database: {
    entityStore: string;
    subEntityStores?: string[];
    schema: DatabaseSchema;
    version: number;
  };
  
  // エンティティハンドラー
  readonly entityHandler: EntityHandler<TEntity, TSubEntity, TWorkingCopy>;
  
  // ライフサイクルフック
  readonly lifecycle: NodeLifecycleHooks<TEntity>;
  
  // UI設定
  readonly ui?: {
    dialogComponent?: React.ComponentType<NodeDialogProps<TEntity>>;
    panelComponent?: React.ComponentType<NodePanelProps>;
    formComponent?: React.ComponentType<NodeFormProps<TEntity>>;
    iconComponent?: React.ComponentType<{ size?: number; color?: string }>;
  };
  
  // API拡張
  readonly api?: {
    workerExtensions?: WorkerAPIExtensions;
    clientExtensions?: ClientAPIExtensions;
  };
  
  // バリデーション
  readonly validation?: {
    namePattern?: RegExp;
    maxChildren?: number;
    allowedChildTypes?: TreeNodeType[];
    customValidators?: ValidationRule<TEntity>[];
  };
}
```

### 7.2.2 エンティティハンドラー

```typescript
// packages/core/src/types/entityHandler.ts

export interface EntityHandler<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> {
  // エンティティ操作
  createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity>;
  getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined>;
  updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void>;
  deleteEntity(nodeId: TreeNodeId): Promise<void>;
  
  // サブエンティティ操作
  createSubEntity?(
    nodeId: TreeNodeId, 
    subEntityType: string, 
    data: TSubEntity
  ): Promise<void>;
  getSubEntities?(
    nodeId: TreeNodeId, 
    subEntityType: string
  ): Promise<TSubEntity[]>;
  deleteSubEntities?(
    nodeId: TreeNodeId, 
    subEntityType: string
  ): Promise<void>;
  
  // ワーキングコピー操作
  createWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy>;
  commitWorkingCopy(
    nodeId: TreeNodeId, 
    workingCopy: TWorkingCopy
  ): Promise<void>;
  discardWorkingCopy(nodeId: TreeNodeId): Promise<void>;
  
  // 特殊操作
  duplicate?(nodeId: TreeNodeId, newNodeId: TreeNodeId): Promise<void>;
  backup?(nodeId: TreeNodeId): Promise<EntityBackup<TEntity>>;
  restore?(nodeId: TreeNodeId, backup: EntityBackup<TEntity>): Promise<void>;
  cleanup?(nodeId: TreeNodeId): Promise<void>;
}

// エンティティバックアップの型定義
export interface EntityBackup<TEntity extends BaseEntity = BaseEntity> {
  entity: TEntity;
  subEntities?: Record<string, BaseSubEntity[]>;
  metadata: {
    backupDate: Timestamp;
    version: string;
    nodeType: TreeNodeType;
  }
}
```

### 7.2.3 ライフサイクルフック

```typescript
// packages/core/src/types/lifecycle.ts

export interface NodeLifecycleHooks<
  TEntity extends BaseEntity = BaseEntity,
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

## 7.3 統合プラグインレジストリ（NodeTypeRegistry）

### 7.3.1 統合レジストリ実装

```typescript
// packages/core/src/registry/NodeTypeRegistry.ts

import type { LoaderFunction, ActionFunction } from 'react-router-dom';

// React Routerアクション定義
export interface PluginRouterAction {
  component: React.LazyExoticComponent<React.ComponentType>;
  loader?: LoaderFunction;
  action?: ActionFunction;
  displayName: string;
}

// 統合プラグイン定義（文書7基準 + React Router統合）
export interface UnifiedPluginDefinition<
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy
> extends NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy> {
  // React Routerルーティング統合
  readonly routing: {
    actions: Record<string, PluginRouterAction>;
    defaultAction?: string;
  };
  
  // プラグインメタデータ
  readonly meta: {
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
    dependencies?: string[];
  };
}

// 統合プラグインレジストリ
export class NodeTypeRegistry {
  private static instance: NodeTypeRegistry;
  private definitions: Map<TreeNodeType, UnifiedPluginDefinition> = new Map();
  private handlers: Map<TreeNodeType, EntityHandler> = new Map();
  private routingActions: Map<string, Map<string, PluginRouterAction>> = new Map(); // nodeType -> action -> config
  
  private constructor() {}
  
  static getInstance(): NodeTypeRegistry {
    if (!NodeTypeRegistry.instance) {
      NodeTypeRegistry.instance = new NodeTypeRegistry();
    }
    return NodeTypeRegistry.instance;
  }
  
  // 統合プラグイン登録（NodeTypeDefinition + Routing）
  registerPlugin<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    const { nodeType, entityHandler, routing } = definition;
    
    if (this.definitions.has(nodeType)) {
      throw new Error(`Node type ${nodeType} is already registered`);
    }
    
    // 統合プラグイン定義の保存
    this.definitions.set(nodeType, definition as UnifiedPluginDefinition);
    this.handlers.set(nodeType, entityHandler as EntityHandler);
    
    // React Routerアクションの登録
    if (routing?.actions) {
      const actionsMap = new Map<string, PluginRouterAction>();
      Object.entries(routing.actions).forEach(([actionName, config]) => {
        actionsMap.set(actionName, config);
      });
      this.routingActions.set(nodeType, actionsMap);
    }
    
    // データベーススキーマの登録
    this.registerDatabaseSchema(definition);
    
    // APIエクステンションの登録
    if (definition.api) {
      this.registerAPIExtensions(definition);
    }
  }

  // 従来のNodeTypeDefinition登録（後方互換性）
  register<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // UnifiedPluginDefinitionに変換して登録
    const unifiedDefinition: UnifiedPluginDefinition<TEntity, TSubEntity, TWorkingCopy> = {
      ...definition,
      routing: {
        actions: {}, // ルーティングアクションなし
      },
      meta: {
        version: '1.0.0',
        description: definition.displayName || definition.name
      }
    };
    
    this.registerPlugin(unifiedDefinition);
  }
  
  unregister(nodeType: TreeNodeType): void {
    this.definitions.delete(nodeType);
    this.handlers.delete(nodeType);
    this.routingActions.delete(nodeType);
  }
  
  getDefinition(nodeType: TreeNodeType): UnifiedPluginDefinition | undefined {
    return this.definitions.get(nodeType);
  }
  
  getHandler(nodeType: TreeNodeType): EntityHandler | undefined {
    return this.handlers.get(nodeType);
  }
  
  getAllDefinitions(): UnifiedPluginDefinition[] {
    return Array.from(this.definitions.values());
  }
  
  // React Router統合メソッド
  getRouterAction(nodeType: TreeNodeType, action: string): PluginRouterAction | undefined {
    const actions = this.routingActions.get(nodeType);
    return actions?.get(action);
  }
  
  getAvailableActions(nodeType: TreeNodeType): string[] {
    const actions = this.routingActions.get(nodeType);
    return actions ? Array.from(actions.keys()) : [];
  }
  
  hasAction(nodeType: TreeNodeType, action: string): boolean {
    return this.routingActions.get(nodeType)?.has(action) ?? false;
  }
  
  // プラグイン検索・フィルタリング
  findPluginsByTag(tag: string): UnifiedPluginDefinition[] {
    return this.getAllDefinitions().filter(def => 
      def.meta?.tags?.includes(tag)
    );
  }
  
  getPluginDependencies(nodeType: TreeNodeType): string[] {
    const definition = this.getDefinition(nodeType);
    return definition?.meta?.dependencies ?? [];
  }
  
  private registerDatabaseSchema<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // Dexieスキーマの動的登録
    const { database } = definition;
    // 実装詳細...
  }
  
  private registerAPIExtensions<TEntity extends BaseEntity, TSubEntity extends BaseSubEntity, TWorkingCopy extends BaseWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void {
    // API拡張の登録
    const { api } = definition;
    // 実装詳細...
  }
}
```

### 7.3.2 ライフサイクルマネージャー

```typescript
// packages/worker/src/lifecycle/NodeLifecycleManager.ts

export class NodeLifecycleManager {
  private registry: NodeTypeRegistry;
  
  constructor() {
    this.registry = NodeTypeRegistry.getInstance();
  }
  
  async executeLifecycleHook<
    TEntity extends BaseEntity = BaseEntity,
    TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
    THookName extends keyof NodeLifecycleHooks<TEntity, TWorkingCopy> = keyof NodeLifecycleHooks<TEntity, TWorkingCopy>
  >(
    hookName: THookName,
    nodeType: TreeNodeType,
    ...args: Parameters<NonNullable<NodeLifecycleHooks<TEntity, TWorkingCopy>[THookName]>>
  ): Promise<void> {
    const definition = this.registry.getDefinition(nodeType);
    if (!definition?.lifecycle) return;
    
    const hook = definition.lifecycle[hookName as keyof NodeLifecycleHooks];
    if (hook && typeof hook === 'function') {
      try {
        // @ts-expect-error - 動的な引数の型チェックは実行時に行う
        await hook(...args);
      } catch (error) {
        console.error(`Lifecycle hook ${hookName} failed for ${nodeType}:`, error);
        throw error;
      }
    }
  }
  
  async handleNodeCreation(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<TreeNodeId> {
    // Before hook
    await this.executeLifecycleHook('beforeCreate', nodeType, parentId, nodeData);
    
    // コア処理（ノード作成）
    const nodeId = await this.createNodeCore(parentId, nodeData);
    
    // エンティティ作成
    const handler = this.registry.getHandler(nodeType);
    if (handler) {
      const entity = await handler.createEntity(nodeId, nodeData.data);
      
      // After hook
      await this.executeLifecycleHook('afterCreate', nodeType, nodeId, entity);
    }
    
    return nodeId;
  }
  
  async handleNodeUpdate(
    nodeId: TreeNodeId,
    changes: Partial<TreeNode>,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Before hook
    await this.executeLifecycleHook('beforeUpdate', nodeType, nodeId, changes);
    
    // コア処理（ノード更新）
    await this.updateNodeCore(nodeId, changes);
    
    // エンティティ更新
    const handler = this.registry.getHandler(nodeType);
    if (handler && changes.data) {
      await handler.updateEntity(nodeId, changes.data);
      const entity = await handler.getEntity(nodeId);
      
      // After hook
      await this.executeLifecycleHook('afterUpdate', nodeType, nodeId, entity);
    }
  }
  
  async handleNodeDeletion(
    nodeId: TreeNodeId,
    nodeType: TreeNodeType
  ): Promise<void> {
    // Before hook
    await this.executeLifecycleHook('beforeDelete', nodeType, nodeId);
    
    // エンティティ削除
    const handler = this.registry.getHandler(nodeType);
    if (handler) {
      await handler.deleteEntity(nodeId);
    }
    
    // コア処理（ノード削除）
    await this.deleteNodeCore(nodeId);
    
    // After hook
    await this.executeLifecycleHook('afterDelete', nodeType, nodeId);
  }
  
  private async createNodeCore(
    parentId: TreeNodeId,
    nodeData: Partial<TreeNode>
  ): Promise<TreeNodeId> {
    // 実装詳細...
    return generateUUID();
  }
  
  private async updateNodeCore(
    nodeId: TreeNodeId,
    changes: Partial<TreeNode>
  ): Promise<void> {
    // 実装詳細...
  }
  
  private async deleteNodeCore(nodeId: TreeNodeId): Promise<void> {
    // 実装詳細...
  }
}
```

## 7.4 プラグインアーキテクチャ

### 7.4.1 プラグインインターフェース

```typescript
// packages/core/src/plugin/Plugin.ts

// プラグイン設定の型
export interface PluginConfig {
  enabled: boolean;
  settings?: Record<string, string | number | boolean>;
}

// プラグインの型定義（Genericsで拡張可能）
export interface Plugin<TContext extends PluginContext = PluginContext> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  
  // ノードタイプ定義（型安全）
  readonly nodeTypes?: Array<NodeTypeDefinition<BaseEntity, BaseSubEntity, BaseWorkingCopy>>;
  
  // 初期化（コンテキストの型を指定可能）
  initialize?(context: TContext): Promise<void>;
  
  // クリーンアップ
  cleanup?(): Promise<void>;
  
  // 依存関係
  readonly dependencies?: string[];
  
  // 設定スキーマ
  readonly configSchema?: Record<string, 'string' | 'number' | 'boolean'>;
}

// プラグインコンテキストの基本型
export interface PluginContext {
  registry: NodeTypeRegistry;
  dbConnection: Dexie;
  apiRegistry: WorkerAPIRegistry;
  uiRegistry: UIComponentRegistry;
}

// プラグイン拡張の型定義
export interface PluginExtension {
  name: string;
  version: string;
  instance: object;
}

// 拡張可能なプラグインコンテキスト
export interface ExtendedPluginContext<T extends Record<string, PluginExtension> = {}> 
  extends PluginContext {
  extensions: T;
}
```

### 7.4.2 プラグインローダー

```typescript
// packages/app/src/plugin/PluginLoader.ts

export class PluginLoader<TContext extends PluginContext = PluginContext> {
  private plugins: Map<string, Plugin<TContext>> = new Map();
  private context: TContext;
  
  constructor(context: TContext) {
    this.context = context;
  }
  
  async loadPlugin<TPluginContext extends TContext>(
    plugin: Plugin<TPluginContext>
  ): Promise<void> {
    // 依存関係チェック
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          throw new Error(`Missing dependency: ${depId}`);
        }
      }
    }
    
    // プラグイン初期化（型安全）
    if (plugin.initialize) {
      await plugin.initialize(this.context as TPluginContext);
    }
    
    // ノードタイプ登録（型安全）
    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.context.registry.register(nodeType);
      }
    }
    
    this.plugins.set(plugin.id, plugin as Plugin<TContext>);
  }
  
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // ノードタイプ登録解除
    if (plugin.nodeTypes) {
      for (const nodeType of plugin.nodeTypes) {
        this.context.registry.unregister(nodeType.nodeType);
      }
    }
    
    // クリーンアップ
    if (plugin.cleanup) {
      await plugin.cleanup();
    }
    
    this.plugins.delete(pluginId);
  }
  
  getPlugin<TPluginContext extends TContext = TContext>(
    pluginId: string
  ): Plugin<TPluginContext> | undefined {
    return this.plugins.get(pluginId) as Plugin<TPluginContext> | undefined;
  }
  
  getAllPlugins(): Plugin<TContext>[] {
    return Array.from(this.plugins.values());
  }
}
```

## 7.5 具体的な実装例：BaseMapノードタイプ

### 7.5.1 BaseMapエンティティ定義

```typescript
// packages/plugins/basemap/src/types/BaseMapEntity.ts

export interface BaseMapEntity extends BaseEntity {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

export interface BaseMapWorkingCopy extends BaseWorkingCopy {
  nodeId: TreeNodeId;
  name: string;
  description?: string;
  mapStyle: 'streets' | 'satellite' | 'hybrid' | 'terrain';
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  workingCopyId: UUID;
  workingCopyOf: TreeNodeId;
  copiedAt: Timestamp;
  isDirty: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### 7.5.2 BaseMapハンドラー実装

```typescript
// packages/plugins/basemap/src/handlers/BaseMapHandler.ts

export class BaseMapHandler implements EntityHandler<
  BaseMapEntity,
  never,
  BaseMapWorkingCopy
> {
  private db: BaseMapDatabase;
  
  constructor(db: BaseMapDatabase) {
    this.db = db;
  }
  
  async createEntity(
    nodeId: TreeNodeId,
    data?: Partial<BaseMapEntity>
  ): Promise<BaseMapEntity> {
    const entity: BaseMapEntity = {
      nodeId,
      name: data?.name || 'New BaseMap',
      description: data?.description,
      mapStyle: data?.mapStyle || 'streets',
      center: data?.center || [0, 0],
      zoom: data?.zoom || 10,
      bearing: data?.bearing || 0,
      pitch: data?.pitch || 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };
    
    await this.db.entities.add(entity);
    return entity;
  }
  
  async getEntity(nodeId: TreeNodeId): Promise<BaseMapEntity | undefined> {
    return await this.db.entities.get(nodeId);
  }
  
  async updateEntity(
    nodeId: TreeNodeId,
    data: Partial<BaseMapEntity>
  ): Promise<void> {
    await this.db.entities.update(nodeId, {
      ...data,
      updatedAt: Date.now(),
      version: (data.version || 0) + 1
    });
  }
  
  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    await this.db.entities.delete(nodeId);
  }
  
  async createWorkingCopy(nodeId: TreeNodeId): Promise<BaseMapWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Entity not found: ${nodeId}`);
    }
    
    const workingCopy: BaseMapWorkingCopy = {
      ...entity,
      workingCopyId: generateUUID(),
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false
    };
    
    await this.db.workingCopies.add(workingCopy);
    return workingCopy;
  }
  
  async commitWorkingCopy(
    nodeId: TreeNodeId,
    workingCopy: BaseMapWorkingCopy
  ): Promise<void> {
    const { workingCopyId, workingCopyOf, copiedAt, isDirty, ...entityData } = workingCopy;
    
    await this.updateEntity(nodeId, entityData);
    await this.db.workingCopies.delete(workingCopy.workingCopyId);
  }
  
  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    const workingCopy = await this.db.workingCopies
      .where('workingCopyOf')
      .equals(nodeId)
      .first();
    
    if (workingCopy) {
      await this.db.workingCopies.delete(workingCopy.workingCopyId);
    }
  }
  
  async duplicate(
    nodeId: TreeNodeId,
    newNodeId: TreeNodeId
  ): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) return;
    
    await this.createEntity(newNodeId, {
      ...entity,
      nodeId: newNodeId,
      name: `${entity.name} (Copy)`
    });
  }
}
```

### 7.5.3 BaseMapノードタイプ定義

```typescript
// packages/plugins/basemap/src/definitions/BaseMapDefinition.ts

export const BaseMapNodeDefinition: NodeTypeDefinition<
  BaseMapEntity,
  never,
  BaseMapWorkingCopy
> = {
  nodeType: 'basemap' as TreeNodeType,
  name: 'BaseMap',
  displayName: 'Base Map',
  icon: 'map',
  color: '#4CAF50',
  
  database: {
    entityStore: 'basemaps',
    schema: {
      basemaps: '&nodeId, name, mapStyle, updatedAt',
      workingCopies: '&workingCopyId, workingCopyOf, copiedAt'
    },
    version: 1
  },
  
  entityHandler: new BaseMapHandler(BaseMapDB.getInstance()),
  
  lifecycle: {
    afterCreate: async (nodeId: TreeNodeId, entity: BaseMapEntity) => {
      console.log(`BaseMap created: ${nodeId}`, entity);
      // 追加の初期化処理
    },
    
    beforeDelete: async (nodeId: TreeNodeId) => {
      // 削除前のクリーンアップ処理
      console.log(`Cleaning up BaseMap: ${nodeId}`);
    }
  },
  
  ui: {
    dialogComponent: lazy(() => import('../ui/BaseMapDialog')),
    panelComponent: lazy(() => import('../ui/BaseMapPanel')),
    formComponent: lazy(() => import('../ui/BaseMapForm'))
  },
  
  api: {
    workerExtensions: {
      getMapPreview: async (nodeId: TreeNodeId): Promise<{ url: string; thumbnail: string }> => {
        // マッププレビュー生成
        return { url: '', thumbnail: '' };
      },
      exportMapConfig: async (nodeId: TreeNodeId): Promise<BaseMapEntity> => {
        // マップ設定のエクスポート
        const handler = new BaseMapHandler(BaseMapDB.getInstance());
        const entity = await handler.getEntity(nodeId);
        if (!entity) throw new Error(`Entity not found: ${nodeId}`);
        return entity;
      }
    }
  },
  
  validation: {
    namePattern: /^[a-zA-Z0-9\-_\s]+$/,
    maxChildren: 0, // リーフノード
    customValidators: [
      {
        name: 'validCoordinates',
        validate: (entity: BaseMapEntity): ValidationResult => {
          const [lng, lat] = entity.center;
          const isValid = lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          return isValid 
            ? { valid: true }
            : { valid: false, message: `Invalid coordinates: [${lng}, ${lat}]` };
        },
        getMessage: (entity: BaseMapEntity) => 
          `Coordinates [${entity.center[0]}, ${entity.center[1]}] are out of valid range`
      }
    ]
  }
};
```

### 7.5.4 BaseMapプラグイン

```typescript
// packages/plugins/basemap/src/index.ts

// MapRenderer の型定義
export interface MapRenderer {
  initialize(): Promise<void>;
  render(config: BaseMapEntity): Promise<{ url: string; thumbnail: string }>;
  cleanup(): Promise<void>;
}

// 型安全なプラグイン定義
export interface BaseMapPluginContext extends PluginContext {
  // BaseMap固有の拡張
  mapRenderer?: MapRenderer;
}

// BaseMapアイコンプロパティの型
export interface BaseMapIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export const BaseMapPlugin: Plugin<BaseMapPluginContext> = {
  id: 'hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'Provides BaseMap node type for map visualization',
  
  nodeTypes: [BaseMapNodeDefinition],
  
  initialize: async (context: BaseMapPluginContext) => {
    console.log('BaseMap plugin initialized');
    
    // データベース初期化
    await BaseMapDB.getInstance().open();
    
    // UI コンポーネント登録（型安全）
    if (context.uiRegistry) {
      context.uiRegistry.registerComponent<BaseMapIconProps>(
        'basemap-icon',
        BaseMapIcon
      );
    }
    
    // マップレンダラーの初期化
    if (context.mapRenderer) {
      await context.mapRenderer.initialize();
    }
  },
  
  cleanup: async () => {
    console.log('BaseMap plugin cleanup');
    await BaseMapDB.getInstance().close();
  }
};
```

## 7.6 Worker API拡張

### 7.6.1 API拡張インターフェース

```typescript
// packages/api/src/extensions/WorkerAPIExtension.ts

// Worker API拡張の型定義
export interface WorkerAPIExtension<
  TMethods extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>
> {
  readonly nodeType: TreeNodeType;
  readonly methods: TMethods;
}

// 型安全なメソッド呼び出し結果
export type InvokeResult<
  T extends WorkerAPIExtension,
  M extends keyof T['methods']
> = T['methods'][M] extends (...args: APIMethodArgs) => Promise<infer R> 
  ? R extends APIMethodReturn 
    ? R 
    : never 
  : never;

export class WorkerAPIRegistry {
  private extensions: Map<TreeNodeType, WorkerAPIExtension<Record<string, WorkerAPIMethod>>> = new Map();
  
  register<T extends Record<string, WorkerAPIMethod>>(
    extension: WorkerAPIExtension<T>
  ): void {
    this.extensions.set(extension.nodeType, extension);
  }
  
  getExtension<T extends Record<string, WorkerAPIMethod> = Record<string, WorkerAPIMethod>>(
    nodeType: TreeNodeType
  ): WorkerAPIExtension<T> | undefined {
    return this.extensions.get(nodeType) as WorkerAPIExtension<T> | undefined;
  }
  
  async invokeMethod<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods,
    TArgs extends Parameters<TMethods[TMethod]>,
    TReturn extends ReturnType<TMethods[TMethod]>
  >(
    nodeType: TreeNodeType,
    methodName: TMethod,
    ...args: TArgs
  ): Promise<TReturn> {
    const extension = this.getExtension<TMethods>(nodeType);
    if (!extension || !extension.methods[methodName]) {
      throw new Error(`Method ${String(methodName)} not found for ${nodeType}`);
    }
    
    return await extension.methods[methodName](...args) as TReturn;
  }
}
```

### 7.6.2 拡張APIの統合

```typescript
// packages/worker/src/services/ExtendedTreeMutationService.ts

interface CommitWorkingCopyPayload {
  workingCopyId: UUID;
  nodeType?: TreeNodeType;
  onNameConflict?: 'error' | 'auto-rename';
}

export class ExtendedTreeMutationService extends TreeMutationServiceImpl {
  private lifecycleManager: NodeLifecycleManager;
  private apiRegistry: WorkerAPIRegistry;
  
  constructor() {
    super();
    this.lifecycleManager = new NodeLifecycleManager();
    this.apiRegistry = new WorkerAPIRegistry();
  }
  
  async commitWorkingCopyForCreate(
    cmd: CommandEnvelope<'commitWorkingCopyForCreate', CommitWorkingCopyPayload>
  ): Promise<{ seq: Seq; nodeId: TreeNodeId }> {
    const { workingCopyId, nodeType } = cmd.payload;
    
    // ノードタイプ取得
    const node = await this.getWorkingCopyNode(workingCopyId);
    const actualNodeType = nodeType || node.treeNodeType;
    
    // ライフサイクル処理を含む作成
    const nodeId = await this.lifecycleManager.handleNodeCreation(
      node.parentTreeNodeId,
      node,
      actualNodeType
    );
    
    return { seq: this.getNextSeq(), nodeId };
  }
  
  // 拡張メソッドの呼び出し（型安全）
  async invokeExtension<
    TMethods extends Record<string, WorkerAPIMethod>,
    TMethod extends keyof TMethods
  >(
    nodeType: TreeNodeType,
    method: TMethod,
    ...args: Parameters<TMethods[TMethod]>
  ): Promise<ReturnType<TMethods[TMethod]>> {
    return await this.apiRegistry.invokeMethod<TMethods, TMethod>(
      nodeType,
      method,
      ...args
    );
  }
}
```

## 7.7 UI拡張

### 7.7.1 UIコンポーネントレジストリ

```typescript
// packages/ui/src/registry/UIComponentRegistry.ts

// コンポーネントプロパティの基本型
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// 型安全なコンポーネントレジストリ
export class UIComponentRegistry {
  private components: Map<string, React.ComponentType<BaseComponentProps>> = new Map();
  private dialogs: Map<TreeNodeType, React.ComponentType<NodeDialogProps<any>>> = new Map();
  
  registerComponent<TProps extends BaseComponentProps>(
    name: string,
    component: React.ComponentType<TProps>
  ): void {
    this.components.set(name, component as React.ComponentType<BaseComponentProps>);
  }
  
  registerDialog<TEntity extends BaseEntity>(
    nodeType: TreeNodeType,
    dialog: React.ComponentType<NodeDialogProps<TEntity>>
  ): void {
    this.dialogs.set(nodeType, dialog as React.ComponentType<NodeDialogProps<any>>);
  }
  
  getComponent<TProps extends BaseComponentProps = BaseComponentProps>(
    name: string
  ): React.ComponentType<TProps> | undefined {
    return this.components.get(name) as React.ComponentType<TProps> | undefined;
  }
  
  getDialog<TEntity extends BaseEntity = BaseEntity>(
    nodeType: TreeNodeType
  ): React.ComponentType<NodeDialogProps<TEntity>> | undefined {
    return this.dialogs.get(nodeType) as React.ComponentType<NodeDialogProps<TEntity>> | undefined;
  }
}
```

### 7.7.2 動的ダイアログレンダリング

```tsx
// packages/ui/src/components/DynamicNodeDialog.tsx

interface DynamicNodeDialogProps<TEntity extends BaseEntity = BaseEntity> {
  nodeType: TreeNodeType;
  nodeId?: TreeNodeId;
  onClose: () => void;
  onSave?: (data: Partial<TEntity>) => Promise<void>;
}

export function DynamicNodeDialog<TEntity extends BaseEntity = BaseEntity>(
  { nodeType, nodeId, onClose, onSave }: DynamicNodeDialogProps<TEntity>
) {
  const registry = useUIComponentRegistry();
  const DialogComponent = registry.getDialog<TEntity>(nodeType);
  
  if (!DialogComponent) {
    return (
      <DefaultNodeDialog 
        nodeType={nodeType} 
        nodeId={nodeId} 
        onClose={onClose} 
      />
    );
  }
  
  return (
    <DialogComponent 
      nodeType={nodeType}
      nodeId={nodeId} 
      onClose={onClose}
      onSave={onSave}
    />
  );
}
```

## 7.8 導入計画

### 7.8.1 フェーズ1: コア基盤（1-2週間）
- NodeTypeDefinitionインターフェース定義
- NodeTypeRegistry実装
- NodeLifecycleManager実装
- 基本的なライフサイクルフック

### 7.8.2 フェーズ2: プラグインシステム（1-2週間）
- Pluginインターフェース定義
- PluginLoader実装
- 依存関係管理
- 動的ロード機能

### 7.8.3 フェーズ3: ノードタイプ実装（2-3週間）
- BaseMapノードタイプ
- Shapesノードタイプ
- Locationsノードタイプ
- その他のeria-cartographノードタイプ

### 7.8.4 フェーズ4: UI統合（1-2週間）
- UIComponentRegistry
- 動的ダイアログシステム
- ノードタイプ別アイコン・カラー

### 7.8.5 フェーズ5: テストと最適化（1週間）
- 単体テスト
- 統合テスト
- パフォーマンス最適化

## 7.9 まとめ

このAOPアーキテクチャにより、以下が実現される：

1. **拡張性**: 新しいノードタイプをプラグインとして追加可能
2. **保守性**: ノードタイプごとの処理が分離され、保守が容易
3. **再利用性**: 共通のライフサイクル処理を再利用
4. **型安全性**: TypeScriptの型システムを活用した安全な実装
5. **柔軟性**: eria-cartographの実装パターンを踏襲しつつ、hierarchidb固有の要件に対応

この設計により、hierarchidbプロジェクトは、eria-cartographで実証済みの堅牢なノードタイプシステムを継承しながら、独自の拡張性を持つことができる。