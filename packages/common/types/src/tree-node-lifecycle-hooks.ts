import type { PeerEntity } from './entity-types.js';
import type { NodeId } from './id-types.js';
import type { TreeNode } from './tree-node-types.js';

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

  onDraftCreated?: (nodeId: NodeId, draft: TEntity) => Promise<void>;
  onDraftCommitted?: (nodeId: NodeId, draft: TEntity) => Promise<void>;
  onDraftDiscarded?: (nodeId: NodeId) => Promise<void>;
}
