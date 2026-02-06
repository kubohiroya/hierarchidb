import type { NodeId, TreeId } from '@hierarchidb/core-types';

export interface TreeRootState {
  rootNodeId: NodeId;
  treeId: TreeId;
  expanded: true | Record<NodeId, boolean>;
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}
