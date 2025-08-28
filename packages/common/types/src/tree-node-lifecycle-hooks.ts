import { PeerEntity } from './entity-types';
import { NodeId } from './id-types';
import { TreeNode } from './tree-node-types';
import { WorkingCopyProperties } from './working-copy-types';

// ライフサイクルフック
export interface NodeLifecycleHooks<
  TEntity extends PeerEntity = PeerEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> {
  // ノードライフサイクル
  beforeCreate?: (parentId: NodeId, nodeData: Partial<TreeNode>) => Promise<void>;
  afterCreate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeUpdate?: (nodeId: NodeId, changes: Partial<TreeNode>) => Promise<void>;
  afterUpdate?: (nodeId: NodeId, entity: TEntity) => Promise<void>;

  beforeDelete?: (nodeId: NodeId) => Promise<void>;
  afterDelete?: (nodeId: NodeId) => Promise<void>;

  // 移動・複製
  beforeMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;
  afterMove?: (nodeId: NodeId, newParentId: NodeId) => Promise<void>;

  beforeDuplicate?: (sourceId: NodeId, targetParentId: NodeId) => Promise<void>;
  afterDuplicate?: (sourceId: NodeId, newNodeId: NodeId) => Promise<void>;

  // ワーキングコピー
  onWorkingCopyCreated?: (nodeId: NodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyCommitted?: (nodeId: NodeId, workingCopy: TWorkingCopy) => Promise<void>;
  onWorkingCopyDiscarded?: (nodeId: NodeId) => Promise<void>;
}
