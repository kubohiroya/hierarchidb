import type { TreeNodeType, Timestamp } from './base';
import type { NodeId, TreeId } from './ids';
import type { WorkingCopyProperties } from './workingCopy';

export interface Tree {
  id: TreeId;
  name: string;
  rootNodeId: NodeId;
  trashRootNodeId: NodeId;
  superRootNodeId: NodeId;
}

export interface TreeNodeBase {
  nodeType: TreeNodeType;
  id: NodeId;
  parentNodeId: NodeId;
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
  references?: NodeId[];
}

export interface TrashItemProperties {
  originalName: string;
  originalParentNodeId: NodeId;
  removedAt: Timestamp;
  isRemoved: boolean; // 【追加】: ゴミ箱状態を表すブール値フラグ
}

/**
 * Draft properties for nodes that are being created but not yet complete
 */
export interface DraftProperties {
  /**
   * Indicates if this is a draft node where entities/sub-entities are incomplete
   * Managed by node-type-specific extension modules
   */
  isDraft?: boolean;
}

export type TreeNode = TreeNodeBase &
  Partial<DraftProperties> &
  Partial<WorkingCopyProperties> &
  Partial<DescendantProperties> &
  Partial<ReferenceProperties> &
  Partial<TrashItemProperties> & 
  Partial<DraftProperties>;

export interface TreeNodeWithChildren extends TreeNode, DescendantProperties {
  children?: NodeId[]; // フラット構造維持
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
