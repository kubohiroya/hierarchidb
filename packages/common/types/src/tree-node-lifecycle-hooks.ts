import { PeerEntity } from './entity-types.js';
import { NodeId } from './id-types.js';
import { TreeNode } from './tree-node-types.js';

export interface NodeLifecycleHooks<TEntity extends PeerEntity = PeerEntity> {
  beforeCreate?: (parentId: NodeId, nodeData: Partial<TreeNode>) => Promise<void>;
  afterCreate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeUpdate?: (nodeId: NodeId, changes: Partial<TreeNode>) => Promise<void>;
  afterUpdate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeDelete?: (nodeId: NodeId) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;

  beforeMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;
  afterMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;

  beforeDuplicate?: (sourceId: NodeId, targetParentId: NodeId) => Promise<void>;
  afterDuplicate?: (sourceId: NodeId, newNodeId: NodeId) => Promise<void>;

  onWorkingCopyCreated?: (nodeId: NodeId, workingCopy: TEntity) => Promise<void>;
  onWorkingCopyCommitted?: (nodeId: NodeId, workingCopy: TEntity) => Promise<void>;
  onWorkingCopyDiscarded?: (nodeId: NodeId) => Promise<void>;
}
