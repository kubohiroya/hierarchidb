import type { NodeId } from './id-types.js';
import type { Timestamp } from './primitive-types.js';

// =============================================================================
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
 */
export interface BaseEntity<ID = NodeId> {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

/**
 * PeerEntity - TreeNode11
 * TreeNode
 * TreeNode1PeerEntity
 * @example StylerEntity, BaseMapEntity
 */
export type PeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = BaseEntity<ID> &
  TData & {
    nodeId: NodeId;
    dialogMode?: 'normal' | 'full';
    resumeStep?: number;
    mapParams?: {
      zoom: number;
      lng: number;
      lat: number;
    };
    disabled?: boolean;
  };

export type SavedPeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = PeerEntity<TData, ID>;

export type DraftPeerEntity<
  TData extends object = Record<string, unknown>,
  ID = NodeId,
> = PeerEntity<Partial<TData>, ID>;

/**
 * GroupEntity - TreeNode1N
 * 1TreeNodeGroupEntity
 * @example FeatureSubEntityGeoJSON
 */
export interface GroupEntity<ID = NodeId> extends BaseEntity<ID> {
  /** Associated tree node (required for GroupEntity). */
  nodeId: NodeId;
  type: string;
}

/**
 * RelationalEntity - TreeNodeNN
 * @example TableMetadataEntityStyler
 */
export interface RelationalEntity<ID = NodeId> extends BaseEntity<ID> {
  nodeIds: NodeId[];
  referenceCount: number;
  lastAccessedAt: Timestamp;
}
