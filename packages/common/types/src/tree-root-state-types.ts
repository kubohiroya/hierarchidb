import { NodeId, TreeId } from './id-types';

export interface TreeRootState {
  rootNodeId: NodeId;
  treeId: TreeId;
  expanded: true | Record<NodeId, boolean>;
}

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ExpandedStateChanges {
  treeId: TreeId;
  rootNodeId: NodeId;
  pageNodeId: NodeId;
  changes: true | Record<NodeId, boolean | null>;
  version: number;
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}
