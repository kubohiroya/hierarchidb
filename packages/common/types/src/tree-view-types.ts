import { NodeId, NodeType, TreeId } from './id-types.js';
import { Timestamp } from './primitive-types.js';
import { TreeNodeWithChildren } from './tree-node-types.js';
import { SortOrder } from './tree-root-state-types.js';

export interface SubTreeChanges {
  treeId: TreeId;
  rootNodeId: NodeId;
  pageNodeId: NodeId;
  changes: Record<NodeId, TreeNodeWithChildren | null>;
  version: number;
}

export interface TreeViewState {
  treeViewId: NodeId;
  treeId: TreeId;
  treeRootNodeType: NodeType;
  pageNodeId: NodeId;
  selected: Set<NodeId>;
  columnWidthRatio: number[];
  columnSort: (null | SortOrder.Asc | SortOrder.Desc)[] | null;
  treeNodes: Record<NodeId, TreeNodeWithChildren>;
  expanded: Record<NodeId, boolean>;
  version: number;
  updatedAt: Timestamp;
}
