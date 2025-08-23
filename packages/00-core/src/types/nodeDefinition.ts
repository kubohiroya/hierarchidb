import type { TreeNodeType, Timestamp } from './base';
import type { TreeNode } from './tree';
import type { WorkingCopyProperties } from './workingCopy';
import type { NodeId, EntityId } from './ids';
import type {
  IconDefinition,
  CategoryDefinition,
  PluginI18nConfig,
  PluginDatabaseConfig,
  PluginUIConfig,
  PluginAPIConfig,
  PluginValidationConfig,
  PluginRoutingConfig,
} from './plugin';

// =============================================================================
// エンティティ基底インターフェース群
// =============================================================================

/**
 * 全エンティティ共通の基本プロパティ
 */
export interface BaseEntity {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * PeerEntity - TreeNodeと1対1で対応するエンティティ
 * 
 * TreeNodeのライフサイクルと同期して作成・削除される。
 * 各TreeNodeに対して必ず1つのPeerEntityが存在する。
 * 
 * @example StyleMapEntity, BaseMapEntity
 */
export interface PeerEntity extends BaseEntity {
  // TreeNodeと1対1で対応するエンティティ
  // TreeNodeのライフサイクルと同期
  nodeId: NodeId;
}

/**
 * GroupEntity - TreeNodeと1対Nで対応するエンティティ
 * 
 * 1つのTreeNodeに対して複数のGroupEntityが存在可能。
 * 個別にライフサイクル管理される。
 * 
 * @example FeatureSubEntity（GeoJSONの個別フィーチャー）
 */
export interface GroupEntity extends BaseEntity {
  nodeId: NodeId;
  type: string;
}

/**
 * RelationalEntity - 複数のTreeNodeとN対Nで対応するエンティティ
 * 
 * リファレンスカウントによるライフサイクル管理。
 * 最後の参照が削除されたときに自動削除される。
 * 
 * @example TableMetadataEntity（複数のStyleMapで共有される表データ）
 */
export interface RelationalEntity extends BaseEntity {
  nodeIds: NodeId[];
  referenceCount: number;
  lastAccessedAt: Timestamp;
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
export type ValidationResult = { valid: true } | { valid: false; message: string };

// プラグイン関連の型定義
export interface PluginCapabilities {
  supportsCreate: boolean;
  supportsUpdate: boolean;
  supportsDelete: boolean;
  supportsChildren: boolean;
  supportedOperations: Array<'create' | 'read' | 'update' | 'delete' | 'move' | 'copy'>;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  nodeType: TreeNodeType;
  status: 'active' | 'inactive' | 'error';
  capabilities?: PluginCapabilities;
  tags?: string[];
  dependencies?: string[];
  
  // Entity reference hints for 3x2 lifecycle management
  entityHints?: EntityReferenceHints;
}

/**
 * Entity reference hints for plugin metadata
 * Simple field name conventions for entity relationships
 */
export interface EntityReferenceHints {
  // PeerEntity/GroupEntity: TreeNodeを参照するプロパティ名
  // デフォルト: 'nodeId'
  nodeRefField?: string;
  
  // RelationalEntity: RelationalEntityを参照するプロパティ名  
  // デフォルト: 'relRef'
  relRefField?: string;
}

// サブスクリプション関連の型定義
export type SubscriptionId = string & { readonly __brand: 'SubscriptionId' };

export interface SubscriptionOptions {
  includeMetadata?: boolean;
  depth?: number;
  excludeTypes?: string[];
  filter?: (event: TreeNodeEvent) => boolean;
}

export interface TreeNodeEvent {
  type: 'created' | 'updated' | 'deleted' | 'moved';
  nodeId: NodeId;
  node?: TreeNode;
  parentNodeId?: NodeId;
  previousParentNodeId?: NodeId;
  timestamp: number;
}

// Working Copy関連の型定義
export interface CommitResult {
  success: boolean;
  node?: TreeNode;
  error?: string;
}

// バリデーションルール
export interface ValidationRule<TEntity extends PeerEntity = PeerEntity> {
  name: string;
  validate: (entity: TEntity) => ValidationResult | Promise<ValidationResult>;
  getMessage?: (entity: TEntity) => string;
}

// 共通のAPIメソッドの型
export type APIMethodArgs = readonly [NodeId, ...any[]];
export type APIMethodReturn =
  | PeerEntity
  | GroupEntity
  | RelationalEntity
  | PeerEntity[]
  | GroupEntity[]
  | RelationalEntity[]
  | string
  | number
  | boolean
  | void
  | { [key: string]: string | number | boolean };

// Worker API拡張メソッド
export type WorkerAPIMethod<
  TArgs extends APIMethodArgs = APIMethodArgs,
  TReturn extends APIMethodReturn = APIMethodReturn,
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
  TReturn extends APIMethodReturn = APIMethodReturn,
> = (...args: TArgs) => TReturn;

export interface ClientAPIExtensions {
  [methodName: string]: ClientAPIMethod;
}

// 型安全なClient API拡張
export interface TypedClientAPIExtensions<T extends Record<string, ClientAPIMethod>> {
  methods: T;
}

// ノード型定義（Core層専用、UI非依存）
export interface NodeTypeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
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
    groupEntityStores?: string[];
    schema: DatabaseSchema;
    version: number;
  };

  // エンティティハンドラー
  readonly entityHandler: EntityHandler<TEntity, TGroupEntity, TWorkingCopy>;

  // ライフサイクルフック
  readonly lifecycle: NodeLifecycleHooks<TEntity>;

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

// エンティティハンドラー
export interface EntityHandler<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> {
  // エンティティ操作
  createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;
  getEntity(nodeId: NodeId): Promise<TEntity | undefined>;
  updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // サブエンティティ操作
  createGroupEntity?(nodeId: NodeId, groupEntityType: string, data: TGroupEntity): Promise<void>;
  getGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<TGroupEntity[]>;
  deleteGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<void>;

  // ワーキングコピー操作
  createWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy>;
  commitWorkingCopy(nodeId: NodeId, workingCopy: TWorkingCopy): Promise<void>;
  discardWorkingCopy(nodeId: NodeId): Promise<void>;

  // 特殊操作
  duplicate?(nodeId: NodeId, newNodeId: NodeId): Promise<void>;
  backup?(nodeId: NodeId): Promise<EntityBackup<TEntity>>;
  restore?(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;
  cleanup?(nodeId: NodeId): Promise<void>;
}

// エンティティバックアップの型定義
export interface EntityBackup<TEntity extends PeerEntity = PeerEntity> {
  entity: TEntity;
  subEntities?: Record<string, GroupEntity[]>;
  metadata: {
    backupDate: Timestamp;
    version: string;
    nodeType: TreeNodeType;
  };
}

// ライフサイクルフック
export interface NodeLifecycleHooks<
  TEntity extends PeerEntity = PeerEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> {
  // ノードライフサイクル
  beforeCreate?: (parentId: NodeId, nodeData: Partial<TreeNode>) => Promise<void>;
  afterCreate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeUpdate?: (nodeId: NodeId, changes: Partial<TreeNode>) => Promise<void>;
  afterUpdate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeDelete?: (nodeId: NodeId) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;

  // 移動・複製
  beforeMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;
  afterMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;

  beforeDuplicate?: (sourceId: NodeId, targetParentId: NodeId) => Promise<void>;
  afterDuplicate?: (sourceId: NodeId, newNodeId: NodeId) => Promise<void>;

  // ワーキングコピー
  onWorkingCopyCreated?: (nodeId: NodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyCommitted?: (nodeId: NodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyDiscarded?: (nodeId: NodeId) => Promise<void>;
}

// =============================================================================
// Plugin Definition Types (moved from worker package)
// =============================================================================

/**
 * Node definition with entity handler
 * Combines core node definition with worker-side entity handler
 */
export interface NodeDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> {
  // Basic node information
  readonly nodeType: TreeNodeType;
  readonly name: string;
  readonly displayName: string;
  
  // i18n configuration
  readonly i18n?: PluginI18nConfig;
  
  // Icon configuration
  readonly icon?: IconDefinition;
  
  // Category configuration - defines which tree(s) this plugin is available in
  readonly category: CategoryDefinition;

  // Entity handler - manages CRUD operations
  readonly entityHandler: EntityHandler<TEntity, TGroupEntity, TWorkingCopy>;

  // Lifecycle hooks with actual implementations
  readonly lifecycle?: NodeLifecycleHooks<TEntity, TWorkingCopy>;

  // Database configuration
  readonly database: PluginDatabaseConfig;

  // UI configuration (optional)
  readonly ui?: PluginUIConfig;

  // API extensions (optional)
  readonly api?: PluginAPIConfig;

  // Validation configuration (optional)
  readonly validation?: PluginValidationConfig;
}

/**
 * Full plugin definition (extends NodeDefinition with routing and metadata)
 * This is the complete definition used for plugin registration
 */
export interface ExtendedPluginDefinition<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> extends NodeDefinition<TEntity, TGroupEntity, TWorkingCopy> {
  // Worker-side routing configuration
  readonly routing: PluginRoutingConfig;

  // Plugin metadata
  readonly meta: PluginMetadata;
}

// =============================================================================
// RelationalEntity管理用のインターフェース
// =============================================================================

/**
 * RelationalEntityの参照管理インターフェース
 */
export interface RelationalEntityManager<TRelationalEntity extends RelationalEntity> {
  /**
   * 新しい参照を追加（参照カウントをインクリメント）
   */
  addReference(entityId: string, nodeId: NodeId): Promise<void>;
  
  /**
   * 参照を削除（参照カウントをデクリメント、0になったら削除）
   */
  removeReference(entityId: string, nodeId: NodeId): Promise<void>;
  
  /**
   * エンティティを取得（存在しない場合は undefined）
   */
  getEntity(entityId: string): Promise<TRelationalEntity | undefined>;
  
  /**
   * エンティティを作成（初期参照カウント=1）
   */
  createEntity(nodeId: NodeId, data: Omit<TRelationalEntity, keyof RelationalEntity>): Promise<TRelationalEntity>;
  
  /**
   * 指定ノードが参照しているエンティティの一覧を取得
   */
  getReferencedEntities(nodeId: NodeId): Promise<TRelationalEntity[]>;
  
  /**
   * 孤立エンティティ（参照カウント=0）をクリーンアップ
   */
  cleanupOrphanedEntities(): Promise<number>; // 削除した数を返す
}
