import type { NodeId, TreeId } from '@hierarchidb/common-types';

export interface FulltextNodeRecord {
  treeId: TreeId;
  nodeId: NodeId;
  parentId?: NodeId;
  name: string;
  description?: string;
  updatedAt: number;
}

export interface FulltextIndexRecord {
  treeId: TreeId;
  locale: string;
  updatedAt: number;
  dirty: boolean;
  serializedIndex?: string;
}
