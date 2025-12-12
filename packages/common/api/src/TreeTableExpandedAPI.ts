import type { NodeId } from '@hierarchidb/common-types';

export interface TreeTableExpandedAPI {
  getExpandedNodes(pageNodeId: NodeId): Promise<NodeId[]>;
  openNodes(pageNodeId: NodeId, nodeIds: NodeId[]): Promise<void>;
  closeNodes(pageNodeId: NodeId, nodeIds: NodeId[]): Promise<void>;
  clearExpandedForPage(pageNodeId: NodeId): Promise<number>;
  clearExpandedForSubtree(nodeIds: NodeId[]): Promise<void>;
}

// Ensure module resolution in NodeNext
export {};
