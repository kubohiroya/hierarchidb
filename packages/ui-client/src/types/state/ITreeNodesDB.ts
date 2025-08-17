/**
 * @file ITreeDB.ts
 * @description Common interface for tree database operations used by CommandManager and other components
 * @module types/domain
 *
 * This interface defines the minimal contract that TreeNodesDB and TreeNodesWorkerService
 * must implement to support CommandManager operations. It provides a consistent API for:
 * - Node CRUD operations
 * - Tree traversal and queries
 * - Trash management
 * - Import/export functionality
 *
 * @example
 * ```typescript
 * class MyTreeService implements ITreeDB {
 *   async getNode(id: TreeNodeId): Promise<TreeNodeEntityWithChildre | undefined> {
 *     // Implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */

import type { TreeNodeId, TreeNodeType } from '@hierarchidb/core';
import type {
  TreeNodeEntity,
  TreeNodeEntityWithChildren,
  DescendantNodeJson,
} from '../CommandManagerTypes';

// TreeNodeDatabaseEntity extends TreeNodeEntity with database-specific fields
interface TreeNodeDatabaseEntity extends TreeNodeEntity {
  index: number;
  descendantsCount: number;
}
// Import Dexie Table type
type Table<_T> = any; // Stub for Dexie Table type

/**
 * Interface for tree database operations
 */
export interface ITreeNodesDB {
  /**
   * Direct access to the treeNodes table for queries
   * Used by CommandManager for direct queries in trash operations
   */
  treeNodes: Table<TreeNodeDatabaseEntity>;

  /**
   * Retrieves a single node by its ID
   * @param id - The node ID to retrieve
   * @returns The node if found, undefined otherwise
   */
  getNode(id: TreeNodeId): Promise<TreeNodeEntityWithChildren | undefined>;

  /**
   * Loads a node and its descendants based on expansion state
   * @param targetId - The ID of the node to load
   * @param expanded - Optional object mapping node IDs to their expansion state
   * @returns The loaded node with populated children and descendant counts
   */
  loadNode(
    targetId: TreeNodeId,
    expanded?: Record<string, boolean>
  ): Promise<TreeNodeEntityWithChildren>;

  /**
   * Loads multiple nodes in batch for efficiency
   * @param nodeIds - Array of node IDs to load
   * @returns Object containing node map and children map
   */
  loadNodesBatch(nodeIds: TreeNodeId[]): Promise<{
    nodeMap: Map<TreeNodeId, TreeNodeEntity>;
    childrenMap: Map<TreeNodeId, TreeNodeEntity[]>;
  }>;

  /**
   * Loads nodes and their children for expanded nodes
   * @param expandedNodeIds - Array of expanded node IDs
   * @returns Object containing node map and children map
   */
  loadNodesAndChildren(expandedNodeIds: TreeNodeId[]): Promise<{
    nodeMap: Map<TreeNodeId, TreeNodeEntity>;
    childrenMap: Map<TreeNodeId, TreeNodeEntity[]>;
  }>;

  /**
   * Creates a new node under the specified parent
   * @param parentId - The ID of the parent node
   * @param src - Node data including name, type, and optional fields
   * @returns The created node with generated ID and timestamps
   */
  createNodeTx(
    parentId: TreeNodeId,
    src: Pick<TreeNodeEntity, 'name' | 'type'> &
      Partial<Pick<TreeNodeEntity, 'id' | 'description' | 'isDraft' | 'workingCopyOf'>>
  ): Promise<TreeNodeEntityWithChildren>;

  /**
   * Updates node attributes (transaction version)
   * @param id - The ID of the node to update
   * @param updates - Partial object with fields to update
   */
  updateNodeTx(
    id: TreeNodeId,
    updates: Partial<
      Pick<TreeNodeEntity, 'name' | 'description' | 'isDraft'> & {
        workingCopyOf?: TreeNodeId | undefined;
      }
    >
  ): Promise<void>;

  /**
   * Updates node attributes (direct version)
   * @param id - The ID of the node to update
   * @param updates - Partial object with fields to update
   */
  updateNode(id: TreeNodeId, updates: Partial<TreeNodeEntity>): Promise<void>;

  /**
   * Moves multiple nodes to a new parent
   * @param params - Object containing destination parent ID and array of node IDs to move
   */
  moveNodesTx(params: { destinationParentId: TreeNodeId; ids: TreeNodeId[] }): Promise<void>;

  /**
   * Duplicates nodes and their descendants
   * @param params - Object containing array of node IDs to duplicate
   * @returns Object with source IDs and newly created duplicate IDs
   */
  duplicateNodesTx(params: {
    ids: TreeNodeId[];
  }): Promise<{ sourceIds: TreeNodeId[]; duplicatedNodeIds: TreeNodeId[] }>;

  /**
   * Gets all descendant nodes of a given node
   * @param nodeId - The parent node ID
   * @returns Array of all descendant nodes
   */
  getAllDescendants(nodeId: TreeNodeId): Promise<TreeNodeEntityWithChildren[]>;

  /**
   * Gets direct child nodes of a given parent node
   * @param parentId - The parent node ID
   * @returns Array of child nodes
   */
  getChildNodes(parentId: TreeNodeId): Promise<TreeNodeEntity[]>;

  /**
   * Gets the path from a node to the root
   * @param nodeId - The node ID to start from
   * @returns Array of nodes representing the path to root
   */
  getPathToRoot(nodeId: TreeNodeId): Promise<TreeNodeEntityWithChildren[]>;

  /**
   * Checks if one node is an ancestor of another
   * @param ancestorId - The potential ancestor node ID
   * @param descendantId - The potential descendant node ID
   * @returns True if ancestor relationship exists
   */
  isAncestorOf(ancestorId: TreeNodeId, descendantId: TreeNodeId): Promise<boolean>;

  /**
   * Groups node IDs by branch, returning only top-level nodes
   * @param ids - Array of node IDs to group
   * @returns Array of top-level ancestor nodes
   */
  groupDescendantsAsync(ids: TreeNodeId[]): Promise<TreeNodeEntity[]>;

  /**
   * Gets the trash root node ID for a given root node type
   * @param rootNodeType - The type of root node
   * @returns The corresponding trash root node ID
   */
  getTrashRootNodeId(rootNodeType: TreeNodeType): TreeNodeId;

  /**
   * Gets the trash root node ID synchronously (worker services only)
   * This is a compatibility method for code that expects synchronous behavior
   * @param rootNodeType - The type of root node
   * @returns The corresponding trash root node ID
   */
  getTrashRootNodeIdSync?(rootNodeType: TreeNodeType): TreeNodeId;

  /**
   * Checks if a node is in the trash
   * @param id - The node ID to check
   * @returns True if the node is in trash
   */
  isTrashed(id: TreeNodeId): Promise<boolean>;

  /**
   * Imports nodes from JSON data
   * @param params - Object containing parent ID and JSON data array
   * @returns Array of imported node IDs
   */
  importNodesTx(params: {
    parentId: TreeNodeId;
    data: DescendantNodeJson[];
  }): Promise<TreeNodeId[]>;

  /**
   * Moves nodes to trash
   * @param params - Object containing node IDs and trash root node ID
   * @returns Array of moved ancestor nodes
   */
  moveToTrashTx(params: {
    ids: TreeNodeId[];
    trashRootNodeId: TreeNodeId;
  }): Promise<TreeNodeEntity[]>;

  /**
   * Recovers nodes from trash
   * @param params - Object containing node IDs, trash root node ID, and optional restore mode
   * @param params.restoreMode - 'restore-to-original-node' (default) or 'restore-to-current-node'
   * @param params.targetNodeId - Target node ID when using 'restore-to-current-node' mode
   */
  recoverFromTrashTx(params: {
    ids: TreeNodeId[];
    trashRootNodeId: TreeNodeId;
    restoreMode?: 'restore-to-original-node' | 'restore-to-current-node';
    targetNodeId?: TreeNodeId;
  }): Promise<void>;

  /**
   * Permanently deletes nodes from trash
   * @param params - Object with optional node IDs, timestamp filter, and trash root node ID
   */
  emptyTrashTx(params: {
    ids?: TreeNodeId[];
    olderThan?: number;
    trashRootNodeId: TreeNodeId;
  }): Promise<void>;

  /**
   * Get all node IDs that will be permanently deleted from emptyTrashTx operation
   * This is a dry-run version of emptyTrashTx to get node IDs for resource cleanup
   * @param params - Object with optional node IDs, timestamp filter, and trash root node ID
   * @returns Array of all node IDs that will be deleted (including descendants)
   */
  getNodeIdsToBeDeleted(params: {
    ids?: TreeNodeId[];
    olderThan?: number;
    trashRootNodeId: TreeNodeId;
  }): Promise<TreeNodeId[]>;

  /**
   * Gets the last set of stale node IDs found during operations
   * @returns Array of stale node IDs
   */
  getLastStaleNodeIds(): TreeNodeId[];

  /**
   * Finds the shallowest node ID from an array of node IDs
   * @param ids - Array of node IDs to search
   * @returns The shallowest node ID, or undefined if none found
   */
  findShallowestNodeId(ids: TreeNodeId[]): Promise<TreeNodeId | undefined>;

  /**
   * Checks if a node can be previewed
   * For projects (isProject=true): Project nodes are always previewable
   * For resources (isProject=false):
   *   - BaseMap nodes are always previewable
   *   - Other resource nodes require at least one descendant of each type (shapes, stylemap, basemap)
   * @param isProject - Whether this is a project node or resource node
   * @param nodeId - The node ID to check
   * @returns True if the node can be previewed
   */
  canPreview(isProject: boolean, nodeId: TreeNodeId): Promise<boolean>;

  /**
   * Efficiently checks which of the provided node IDs actually exist in the database
   * @param nodeIds - Array of node IDs to check for existence
   * @returns Object containing arrays of existing and missing node IDs
   */
  checkNodeExistence(nodeIds: TreeNodeId[]): Promise<{
    existingIds: TreeNodeId[];
    missingIds: TreeNodeId[];
  }>;
}
