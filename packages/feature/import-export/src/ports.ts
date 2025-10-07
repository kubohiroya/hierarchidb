import type { NodeId, TreeNode } from '@hierarchidb/common-types';

export interface ImportExportDBPort {
  bulkCreateNodes(nodes: TreeNode[]): Promise<void>;

  listChildren(parentId: NodeId): Promise<TreeNode[]>;

  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
}
