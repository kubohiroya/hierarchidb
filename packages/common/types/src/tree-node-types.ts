import { NodeId, NodeType } from './id-types';
import { Timestamp } from './primitive-types';
import { WorkingCopyProperties } from './working-copy-types';

/**
 * Regular node type constants for common node types
 */
export const NODE_TYPES = {
  FOLDER: 'folder',
  FILE: 'file',
  // Plugin-specific types will be added dynamically
} as const;

export interface NodeBase {
  id: NodeId;
  parentId: NodeId;
  nodeType: NodeType;
  name: string;
  description?: string;
  depth: number; // Mandatory depth property for efficient subscription filtering
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
  originalParentId: NodeId;
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

export type TreeNode = NodeBase &
  Partial<DraftProperties> &
  Partial<WorkingCopyProperties> &
  Partial<DescendantProperties> &
  Partial<ReferenceProperties> &
  Partial<TrashItemProperties> &
  Partial<DraftProperties>;

export interface TreeNodeWithChildren extends TreeNode, DescendantProperties {
  children?: NodeId[]; // フラット構造維持
}
