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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface AutoLifecycleConfig {
  /** List of entity metadata for this node type */
  entities: EntityMetadata[];
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
 * @example StylerEntity, BaseMapEntity
 */
export interface PeerEntity extends BaseEntity {
  // TreeNodeと1対1で対応するエンティティ
  // TreeNodeのライフサイクルと同期
  nodeId: NodeId;
  // ダイアログ表示モードの設定（オプション）
  dialogMode?: 'normal' | 'full';
  // ダイアログの再開ステップ番号（オプション）
  resumeStep?: number;
  // 地図表示パラメータ（zoom, lng, lat）（オプション）

  mapParams?: {
    zoom: number;
    lng: number;
    lat: number;
  };
  // ノードの表示・検索からの除外設定（オプション）
  // デフォルト: undefined（有効）
  // true: このノード（フォルダの場合は子孫含む）を除外
  // 実際の適用値は親階層からの論理和で決定される
  disabled?: boolean;
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
 * @example TableMetadataEntity（複数のStylerで共有される表データ）
 */
export interface RelationalEntity extends BaseEntity {
  nodeIds: NodeId[];
  referenceCount: number;
  lastAccessedAt: Timestamp;
}
