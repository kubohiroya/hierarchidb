import type { NodeId, NodeType } from './id-types.js';
import type { Timestamp } from './primitive-types.js';

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

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface DescendantProperties {
  hasChildren?: boolean;
  descendantCount?: number;
  isEstimated?: boolean;
}

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ReferenceProperties {
  references?: NodeId[];
}

/**
 * Draft properties for nodes that are being created but not yet complete
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface DraftProperties {
  /**
   * Indicates if this is a draft node where entities/sub-entities are incomplete
   * Managed by plugin-loader-specific extension modules
   */
  isDraft?: boolean;
}

export type TreeNode = NodeBase &
  Partial<DraftProperties> &
  Partial<DescendantProperties> &
  Partial<ReferenceProperties> &
  // Holder-based WorkingCopy/Trash meta (indexed lookup)
  Partial<{
    holderType: 'workingCopy' | 'trash';
    holderTargetId: NodeId; // WC: original nodeId, Trash: trashed nodeId
    holderMetaParentId: NodeId; // WC: target parentId, Trash: original parentId
    originalName: string;
    originalParentId: NodeId;
    removedAt: Timestamp;
  }>;

export interface TreeNodeWithChildren extends TreeNode, DescendantProperties {
  children?: NodeId[];
}
