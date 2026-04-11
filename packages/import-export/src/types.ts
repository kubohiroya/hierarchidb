import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';

export interface VectorTileRecord {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data_Uint8Array: Uint8Array;
  size: number;
  features: number;
  generatedAt: number;
}

export interface ImportExportDBPort {
  bulkCreateNodes(nodes: TreeNode[]): Promise<void>;

  listChildren(parentId: NodeId): Promise<TreeNode[]>;

  getNode(nodeId: NodeId): Promise<TreeNode | undefined>;

  listVectorTileRecords(nodeIds: NodeId[]): Promise<VectorTileRecord[]>;
}
