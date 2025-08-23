import type {
  ErrorCode as CoreErrorCode,
  Seq,
  Timestamp,
  TreeNode,
  NodeId,
} from '@hierarchidb/00-core';

/**
 * Worker-specific command envelope
 * Maps core's 'kind' to 'type' for backward compatibility
 */
export type CommandEnvelope<TType extends string, TPayload> = {
  commandId: string;
  groupId: string;
  kind: TType;
  payload: TPayload;
  issuedAt: Timestamp;
  sourceViewId?: string;
  onNameConflict?: 'error' | 'auto-rename';
  type?: TType; // Alias for 'kind' for backward compatibility
  meta?: CommandMeta; // Optional worker-specific metadata
};

/**
 * Command metadata
 */
export interface CommandMeta {
  commandId: string;
  timestamp: Timestamp;
  userId?: string;
  correlationId?: string;
}

// Worker-specific ErrorCode enum for runtime use
// Includes all Core error codes plus worker-specific ones
export const WorkerErrorCode = {
  // Core error codes
  NAME_NOT_UNIQUE: 'NAME_NOT_UNIQUE',
  STALE_VERSION: 'STALE_VERSION',
  HAS_INBOUND_REFS: 'HAS_INBOUND_REFS',
  ILLEGAL_RELATION: 'ILLEGAL_RELATION',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  INVALID_OPERATION: 'INVALID_OPERATION',
  // Worker-specific error codes
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  WORKING_COPY_NOT_FOUND: 'WORKING_COPY_NOT_FOUND',
  COMMIT_CONFLICT: 'COMMIT_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type WorkerErrorCode = (typeof WorkerErrorCode)[keyof typeof WorkerErrorCode];

// Worker-specific CommandResult that extends CoreCommandResult
// Use CoreErrorCode type for interface compatibility
export type CommandResult =
  | {
      success: true;
      seq: Seq;
      nodeId?: NodeId;
      newNodeIds?: NodeId[];
      clipboardData?: {
        type: 'nodes-copy';
        timestamp: number;
        nodes: Record<string, TreeNode>;
        rootNodeIds: NodeId[];
        nodeCount?: number;
      };
    }
  | {
      success: false;
      error: string;
      code: CoreErrorCode | WorkerErrorCode; // Allow both for compatibility
      seq?: Seq; // 失敗時もseqは採番される場合がある
    };

/**
 * Command event for tracking
 */
export interface CommandEvent {
  commandId: string;
  timestamp: Timestamp;
  correlationId?: string;
  result: CommandResult;
}
