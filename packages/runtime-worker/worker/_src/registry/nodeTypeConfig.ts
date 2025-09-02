import type { NodeType } from '@hierarchidb/common-type';

/**
 * Configuration for a node type
 */
export type NodeTypeConfig = {
  icon?: string;
  color?: string;
  displayName?: string;
  allowedChildren?: NodeType[];
  maxChildren?: number;
  canBeRoot?: boolean;
  canBeDeleted?: boolean;
  canBeRenamed?: boolean;
  canBeMoved?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};
