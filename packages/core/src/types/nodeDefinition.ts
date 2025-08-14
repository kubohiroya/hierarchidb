import type { TreeNodeId, TreeNodeType, Timestamp, UUID } from './base';
import type { TreeNode } from './tree';

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
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
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
  TEntity extends BaseEntity = BaseEntity,
  TSubEntity extends BaseSubEntity = BaseSubEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> {
  // エンティティ操作
  createEntity(nodeId: TreeNodeId, data?: Partial<TEntity>): Promise<TEntity>;
  getEntity(nodeId: TreeNodeId): Promise<TEntity | undefined>;
  updateEntity(nodeId: TreeNodeId, data: Partial<TEntity>): Promise<void>;
  deleteEntity(nodeId: TreeNodeId): Promise<void>;

  // サブエンティティ操作
  createSubEntity?(nodeId: TreeNodeId, subEntityType: string, data: TSubEntity): Promise<void>;
  getSubEntities?(nodeId: TreeNodeId, subEntityType: string): Promise<TSubEntity[]>;
  deleteSubEntities?(nodeId: TreeNodeId, subEntityType: string): Promise<void>;

  // ワーキングコピー操作
  createWorkingCopy(nodeId: TreeNodeId): Promise<TWorkingCopy>;
  commitWorkingCopy(nodeId: TreeNodeId, workingCopy: TWorkingCopy): Promise<void>;
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
  };
}

// ライフサイクルフック
export interface NodeLifecycleHooks<
  TEntity extends BaseEntity = BaseEntity,
  TWorkingCopy extends BaseWorkingCopy = BaseWorkingCopy,
> {
  // ノードライフサイクル
  beforeCreate?: (parentId: TreeNodeId, nodeData: Partial<TreeNode>) => Promise<void>;
  afterCreate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  beforeUpdate?: (nodeId: TreeNodeId, changes: Partial<TreeNode>) => Promise<void>;
  afterUpdate?: (nodeId: TreeNodeId, entity: TEntity) => Promise<void>;

  beforeDelete?: (nodeId: TreeNodeId) => Promise<void>;
  afterDelete?: (nodeId: TreeNodeId) => Promise<void>;

  // 移動・複製
  beforeMove?: (nodeId: TreeNodeId, newParentId: TreeNodeId) => Promise<void>;
  afterMove?: (nodeId: TreeNodeId, newParentId: TreeNodeId) => Promise<void>;

  beforeDuplicate?: (sourceId: TreeNodeId, targetParentId: TreeNodeId) => Promise<void>;
  afterDuplicate?: (sourceId: TreeNodeId, newNodeId: TreeNodeId) => Promise<void>;

  // ワーキングコピー
  onWorkingCopyCreated?: (nodeId: TreeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyCommitted?: (nodeId: TreeNodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyDiscarded?: (nodeId: TreeNodeId) => Promise<void>;
}
