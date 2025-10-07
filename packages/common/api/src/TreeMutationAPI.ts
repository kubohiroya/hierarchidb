import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';

/**
  * API
   */
export interface TreeMutationAPI {
  /**
         * @param params -
   * @param params.nodeType -
   * @param params.treeId - ID
   * @param params.parentId - ID
   * @param params.name -
   * @param params.description -
   * @returns ID
      */
  createNode(params: {
    nodeType: NodeType;
    treeId: TreeId;
    parentId: NodeId;
    name: string;
    description?: string;
  }): Promise<{ success: true; nodeId: NodeId } | { success: false; error: string }>;

  /**
         * @param params -
   * @param params.nodeId - ID
   * @param params.name -
   * @param params.description -
   * @returns
      */
  updateNode(params: {
    nodeId: NodeId;
    name?: string;
    description?: string;
  }): Promise<{ success: boolean; error?: string }>;

  /**
         * @param params -
   * @param params.nodeIds - ID
   * @param params.toParentId - ID
   * @param params.onNameConflict - : 'error'
   * @returns
      */
  moveNodes(params: {
    nodeIds: NodeId[];
    toParentId: NodeId;
    onNameConflict?: 'error' | 'auto-rename';
  }): Promise<{ success: boolean; error?: string }>;

  /**
         * @param params -
   * @param params.nodeIds - ID
   * @param params.toParentId - ID
   * @returns ID
      */
  duplicateNodes(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: true; nodeIds: NodeId[] } | { success: false; error: string }>;

  /**
         * @param nodeIds - ID
   * @returns
      */
  removeNodes(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
         * @param nodeIds - ID
   * @returns
      */
  moveNodesToTrash(nodeIds: NodeId[]): Promise<{ success: boolean; error?: string }>;

  /**
         * @param params -
   * @param params.nodeIds - ID
   * @param params.toParentId - ID
   * @returns
      */
  restoreNodesFromTrash(params: {
    nodeIds: NodeId[];
    toParentId?: NodeId;
  }): Promise<{ success: boolean; error?: string }>;

  /**
   * Permanently remove all descendants under the given root (e.g., empty trash).
   */
  removeSubtree(rootId: NodeId): Promise<{ success: boolean; error?: string }>;
}
