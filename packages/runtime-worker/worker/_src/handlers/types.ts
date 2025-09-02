/**
import type { NodeId, NodeType } from '@hierarchidb/common-type';
 * @file lifecycle-types.ts
 * @description Re-export handler types from core to avoid duplication
 */

import { NodeId } from '@hierarchidb/common-type';

// Worker-specific extensions (if needed)

/**
 * Configuration for entity handler
 * This is worker-specific and not defined in core
 */
export interface EntityHandlerConfig {
  tableName: string;
  groupEntityTableName?: string;
  workingCopyTableName?: string;
  cascadeDelete?: boolean;
  versionControl?: boolean;
}

/**
 * Working copy base structure for worker-specific operations
 * @deprecated Use WorkingCopyTypes from core instead
 */
export interface WorkingCopyBase {
  workingCopyId: string;
  nodeId: NodeId;
  isDraft?: boolean;
  workingCopyOf?: NodeId;
  copiedAt: number;
  updatedAt: number;
}
