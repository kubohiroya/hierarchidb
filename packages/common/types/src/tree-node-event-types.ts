import { NodeId } from './id-types';
import { TreeNode } from './tree-node-types';

export interface TreeNodeEvent {
  type: 'created' | 'updated' | 'deleted' | 'moved';
  nodeId: NodeId;
  node?: TreeNode;
  parentId?: NodeId;
  previousParentNodeId?: NodeId;
  timestamp: number;
}
