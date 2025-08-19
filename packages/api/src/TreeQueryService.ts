import type {
  CommandResult,
  TreeNode,
  CopyNodesPayload,
  ExportNodesPayload,
  GetNodePayload,
  GetChildrenPayload,
  GetDescendantsPayload,
  GetAncestorsPayload,
  SearchNodesPayload,
  Tree,
  GetTreePayload,
} from '@hierarchidb/core';

export interface TreeQueryService {
  getTrees(): Promise<Tree[]>;

  getTree(payload: GetTreePayload): Promise<Tree | undefined>;

  // Basic query operations
  getNode(payload: GetNodePayload): Promise<TreeNode | undefined>;

  getChildren(payload: GetChildrenPayload): Promise<TreeNode[]>;

  getDescendants(payload: GetDescendantsPayload): Promise<TreeNode[]>;

  getAncestors(payload: GetAncestorsPayload): Promise<TreeNode[]>;

  // Search operations
  searchNodes(payload: SearchNodesPayload): Promise<TreeNode[]>;

  // Copy/Export operations
  copyNodes(payload: CopyNodesPayload): Promise<CommandResult>;

  exportNodes(payload: ExportNodesPayload): Promise<CommandResult>;
}
