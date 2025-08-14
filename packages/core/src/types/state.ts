import type { TreeId, TreeNodeId, TreeRootNodeType, TreeRootNodeId, Timestamp, UUID } from './base';
import type { TreeNodeWithChildren } from './tree';

export interface TreeRootState {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  expanded: true | Record<TreeNodeId, boolean>;
}

export interface ExpandedStateChanges {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: true | Record<TreeNodeId, boolean | null>;
  version: number;
}

export interface SubTreeChanges {
  treeId: TreeId;
  treeRootNodeId: TreeRootNodeId;
  pageNodeId: TreeNodeId;
  changes: Record<TreeNodeId, TreeNodeWithChildren | null>;
  version: number;
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export interface TreeViewState {
  treeViewId: UUID;
  treeId: TreeId;
  treeRootNodeType: TreeRootNodeType;
  pageNodeId: TreeNodeId;
  selected: Set<TreeNodeId>;
  columnWidthRatio: number[];
  columnSort: (null | SortOrder.Asc | SortOrder.Desc)[] | null;
  treeNodes: Record<TreeNodeId, TreeNodeWithChildren>;
  expanded: Record<TreeNodeId, boolean>;
  version: number;
  updatedAt: Timestamp;
}
