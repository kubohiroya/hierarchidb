/**
 * @file types.ts
 * @description Re-export handler types from core to avoid duplication
 */

// Re-export all handler types from core
export type {
  BaseEntity,
  GroupEntity,
  WorkingCopy,
  EntityBackup,
  EntityHandler,
} from '@hierarchidb/common-core';

// Worker-specific extensions (if needed)
import type { NodeId } from '@hierarchidb/common-core';

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
 * @deprecated Use WorkingCopy from core instead
 */
export interface WorkingCopyBase {
  workingCopyId: string;
  nodeId: NodeId;
  isDraft?: boolean;
  workingCopyOf?: NodeId;
  copiedAt: number;
  updatedAt: number;
}
