/**
 * @file entityMetadata.ts
 * @description Type definitions for automatic entity lifecycle management
 */

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
 * Auto lifecycle configuration for a node type
 */
export interface AutoLifecycleConfig {
  /** List of entity metadata for this node type */
  entities: EntityMetadata[];
}