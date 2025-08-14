import { TreeNodeEntity } from './TreeNodeEntity';

/**
 * Extended tree node entity for database storage
 * This interface extends the base TreeNodeEntity with additional fields
 * that are stored in the database but not part of the core business logic.
 */
export interface TreeNodeDatabaseEntity extends TreeNodeEntity {
  /**
   * Order index for siblings under the same parent
   * Used for consistent ordering of nodes in the tree
   */
  index: number;

  /**
   * Cached count of all descendants
   * This is a performance optimization to avoid recursive queries
   */
  descendantsCount: number;
}

/**
 * Properties that can be stored in the database but are not part of the core entity
 * These are typically used for specific resource types or temporary operations
 */
export interface TreeNodeExtendedProperties {
  /**
   * Entity ID for linking to resource-specific data
   * Used by StyleMap, Shapes, and other resource types
   */
  entityId?: string;

  /**
   * Resource type for resource nodes
   * Used to identify the specific type of resource
   */
  resourceType?: number;

  /**
   * User ID who moved the node to trash
   * Currently not implemented but reserved for future use
   */
  trashedBy?: string;
}

/**
 * Complete database entity including all possible properties
 * This type should only be used in database operations
 */
export type TreeNodeFullDatabaseEntity = TreeNodeDatabaseEntity & TreeNodeExtendedProperties;
