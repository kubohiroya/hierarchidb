import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';

/**
 * Mutation API for creating and managing nodes within a console hierarchy.
 */
export interface TreeMutationAPI {
  /**
   * Create a new node under a given parent.
   * @param params - Parameters describing the node to create.
   * @returns A promise resolving with the new node identifier or an error payload.
   * @remarks
   * - `params.nodeType`: Node type for the new node.
   * - `params.treeId`: Identifier of the console that owns the node.
   * - `params.parentId`: Node identifier that will be the parent of the new node.
   * - `params.name`: Display name for the node.
   * - `params.description`: Optional description shown in the UI.
   */
  createNode(params: {
    nodeType: NodeType;
    treeId: TreeId;
    parentId: NodeId;
    name: string;
    description?: string;
    isTemporary?: boolean;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }>;

  /**
   * Update an existing node's metadata.
   * @param params - Update payload.
   * @returns A promise resolving to the success flag and optional error message.
   * @remarks
   * - `params.nodeId`: Identifier of the node to update.
   * - `params.name`: Optional new display name.
   * - `params.description`: Optional new description.
   * - `params.invisible`: Optional visibility toggle for map previews.
   * - `params.visible`: Optional visibility toggle (default: true when undefined).
   */
  updateNode(params: {
    nodeId: NodeId;
    name?: string;
    description?: string;
    invisible?: boolean;
    visible?: boolean;
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * Move one or more nodes to a new parent.
   * @param params - Move configuration.
   * @returns A promise resolving to the success flag and optional error message.
   * @remarks
   * - `params.nodeIds`: Node identifiers to move.
   * - `params.toParentId`: Destination parent identifier.
   * - `params.onNameConflict`: Strategy when encountering naming collisions.
   */
  moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * Duplicate nodes to the specified parent.
   * @param params - Duplicate configuration.
   * @returns A promise resolving with identifiers of the duplicated nodes or an error payload.
   * @remarks
   * - `params.nodeIds`: Node identifiers to duplicate.
   * - `params.toParentId`: Optional destination parent for the duplicates.
   */
  duplicateNodes(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }>;

  /**
   * Remove nodes permanently from the console.
   * @param nodeIds - Node identifiers to delete.
   * @returns A promise resolving to the success flag and optional error message.
   */
  removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
   * Move nodes into the trash container.
   * @param nodeIds - Node identifiers targeted for soft deletion.
   * @returns A promise resolving to the success flag and optional error message.
   */
  moveNodesToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
   * Restore previously trashed nodes.
   * @param params - Restore configuration.
   * @returns A promise resolving to the success flag and optional error message.
   * @remarks
   * - `params.nodeIds`: Node identifiers to restore.
   * - `params.toParentId`: Optional destination parent; defaults to the original parent.
   */
  restoreNodesFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * Permanently remove all descendants under the given root (e.g., empty trash).
   * @param rootId - Node identifier whose subtree should be removed.
   * @returns A promise resolving to the success flag and optional error message.
   */
  removeSubtree(rootId: NodeId): Promise<{ success: boolean; error?: string }>;
}
