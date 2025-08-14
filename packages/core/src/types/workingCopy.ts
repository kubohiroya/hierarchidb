import type { UUID, TreeNodeId, TreeNodeType, Timestamp } from './base';
import type { DraftProperties } from './draft';

/**
 * Properties for working copies (temporary copies of nodes being edited)
 */
export interface WorkingCopyProperties {
  workingCopyOf?: TreeNodeId; // ID of the original entity if this is a working copy (undefined for new nodes)
  copiedAt?: Timestamp; // Timestamp when the working copy was created
}

/**
 * Complete working copy entity stored in EphemeralDB
 */
export interface WorkingCopy extends WorkingCopyProperties, DraftProperties {
  workingCopyId: UUID;
  parentTreeNodeId: TreeNodeId;
  treeNodeType: TreeNodeType;
  name: string;
  description?: string;
  updatedAt: Timestamp;
}
