import type { NodeId } from './id-types.js';
import type { TreeNode } from './tree-node-types.js';

export interface TreeNodeEvent {
  type: 'created' | 'updated' | 'deleted' | 'moved';
  nodeId: NodeId;
  node?: TreeNode;
  parentId?: NodeId;
  previousParentNodeId?: NodeId;
  timestamp: number;
}
