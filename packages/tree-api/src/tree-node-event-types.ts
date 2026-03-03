import type { NodeId } from '@hierarchidb/core-types';
import type { TreeChangeEventType } from './command-types.js';
import type { TreeNode } from './NODE_TYPES.js';

export interface TreeNodeEvent {
  type: 'created' | 'updated' | 'deleted' | 'moved';
  nodeId: NodeId;
  node?: TreeNode;
  parentId?: NodeId;
  previousParentNodeId?: NodeId;
  timestamp: number;
}

export interface TreeChangeEvent {
  type: TreeChangeEventType;
  nodeId: NodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  parentId?: NodeId;
  previousParentId?: NodeId;
  affectedChildren?: NodeId[];
  timestamp: number;
}
