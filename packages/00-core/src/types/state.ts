import type { TreeNodeType, Timestamp } from './base';
import type { NodeId, TreeId } from './ids';
import type { TreeNodeWithChildren } from './tree';

export interface TreeRootState {
  treeId: TreeId;
  rootNodeId: NodeId;
  expanded: true | Record<NodeId, boolean>;
}

export interface ExpandedStateChanges {
  treeId: TreeId;
  rootNodeId: NodeId;
  pageNodeId: NodeId;
  changes: true | Record<NodeId, boolean | null>;
  version: number;
}

export interface SubTreeChanges {
  treeId: TreeId;
  rootNodeId: NodeId;
  pageNodeId: NodeId;
  changes: Record<NodeId, TreeNodeWithChildren | null>;
  version: number;
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export interface TreeViewState {
  treeViewId: NodeId;
  treeId: TreeId;
  treeRootNodeType: TreeNodeType;
  pageNodeId: NodeId;
  selected: Set<NodeId>;
  columnWidthRatio: number[];
  columnSort: (null | SortOrder.Asc | SortOrder.Desc)[] | null;
  treeNodes: Record<NodeId, TreeNodeWithChildren>;
  expanded: Record<NodeId, boolean>;
  version: number;
  updatedAt: Timestamp;
}
