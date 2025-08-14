import type { TreeId, TreeRootNodeId, TreeNodeId, TreeNodeType, Timestamp } from './base';
import type { DraftProperties } from './draft';
import type { WorkingCopyProperties } from './workingCopy';

export interface Tree {
  treeId: TreeId;
  name: string;
  treeRootNodeId: TreeRootNodeId;
  treeTrashRootNodeId: TreeRootNodeId;
  superRootNodeId: TreeRootNodeId;
}

export interface TreeNodeBase {
  treeNodeType: TreeNodeType;
  treeNodeId: TreeNodeId;
  parentTreeNodeId: TreeNodeId;
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

export interface DescendantProperties {
  hasChildren?: boolean; // 子ノードの有無
  descendantCount?: number; // 直接の子ノード数
  isEstimated?: boolean; // 推定値フラグ（大量データ時の最適化）
}

export interface ReferenceProperties {
  references?: TreeNodeId[];
}

export interface TrashItemProperties {
  originalName: string;
  originalParentTreeNodeId: TreeNodeId;
  removedAt: Timestamp;
}

export type TreeNode = TreeNodeBase &
  Partial<DraftProperties> &
  Partial<WorkingCopyProperties> &
  Partial<DescendantProperties> &
  Partial<ReferenceProperties> &
  Partial<TrashItemProperties>;

export interface TreeNodeWithChildren extends TreeNode, DescendantProperties {
  children?: TreeNodeId[]; // フラット構造維持
}

export enum TreeNodeAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move',
  DUPLICATE = 'duplicate',
  IMPORT = 'import',
  EXPORT = 'export',
  RESTORE = 'restore',
  DISCARD = 'discard',
}
