/**
 * @file types.ts
 * @description Re-export handler types from core to avoid duplication
 */

// Re-export all handler types from core
export type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityBackup,
  EntityHandler,
} from '@hierarchidb/core';

// Worker-specific extensions (if needed)
import type { TreeNodeId, UUID } from '@hierarchidb/core';

/**
 * Configuration for entity handler
 * This is worker-specific and not defined in core
 */
export interface EntityHandlerConfig {
  tableName: string;
  subEntityTableName?: string;
  workingCopyTableName?: string;
  cascadeDelete?: boolean;
  versionControl?: boolean;
}

/**
 * Working copy base structure for worker-specific operations
 * @deprecated Use BaseWorkingCopy from core instead
 */
export interface WorkingCopyBase {
  workingCopyId: UUID;
  nodeId: TreeNodeId;
  isDraft?: boolean;
  workingCopyOf?: TreeNodeId;
  copiedAt: number;
  updatedAt: number;
}
