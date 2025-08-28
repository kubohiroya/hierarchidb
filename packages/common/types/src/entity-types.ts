import type { NodeId, EntityId } from './id-types';
import { Timestamp } from './primitive-types';

// =============================================================================
// エンティティ基底インターフェース群
// =============================================================================

/**
 * Entity type classification
 */
export type EntityType = 'peer' | 'group' | 'relational';

/**
 * Entity relationship with TreeNode
 */
export interface EntityRelationship {
  /** Relationship type between entity and TreeNode */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';

  /** Foreign key field name that references TreeNode */
  foreignKeyField: string;

  /** Whether to cascade delete when TreeNode is deleted */
  cascadeDelete: boolean;
}

/**
 * Reference count management for relational entities
 * Used for shared resources like CSV files
 */
export interface ReferenceManagement {
  /** Field name for reference count */
  countField: string;

  /** Field name for list of referencing node IDs */
  nodeListField: string;

  /** Auto-delete entity when reference count reaches zero */
  autoDeleteWhenZero: boolean;
}
/**
 * Auto lifecycle configuration for a node type
 */
export interface AutoLifecycleConfig {
  /** List of entity metadata for this node type */
  entities: EntityMetadata[];
}

/**
 * Working copy configuration
 */
export interface WorkingCopyConfig {
  /** Whether working copy is enabled for this entity */
  enabled: boolean;

  /** Store name for working copies */
  tableName: string;
}

/**
 * Complete entity metadata for lifecycle management
 */
export interface EntityMetadata {
  /** Entity type classification */
  entityType: EntityType;

  /** Dexie store name */
  tableName: string;

  /** Relationship configuration with TreeNode */
  relationship: EntityRelationship;

  /** Reference management for relational entities */
  referenceManagement?: ReferenceManagement;

  /** Working copy configuration */
  workingCopyConfig?: WorkingCopyConfig;
}

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
