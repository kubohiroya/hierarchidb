import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';

export interface ImportExportDBPort {
  bulkCreateNodes(nodes: TreeNode[]): Promise<void>;

  listChildren(parentId: NodeId): Promise<TreeNode[]>;

  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
}
