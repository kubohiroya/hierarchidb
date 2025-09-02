import type { NodeId, TreeNode, NodeType, ValidationResult } from '@hierarchidb/common-type';

export interface ImportExportDBPort {
  bulkCreateNodes(nodes: TreeNode[]): Promise<void>;
  listChildren(parentId: NodeId): Promise<TreeNode[]>;
  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;
}

