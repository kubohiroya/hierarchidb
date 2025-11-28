import type {
  CommandResult as CoreCommandResult,
  ErrorCode as CoreErrorCode,
  Timestamp,
} from '@hierarchidb/common-types';

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

// Error model unification: align with Core ErrorCode/CommandResult
export const WorkerErrorCode: { [K in CoreErrorCode]: CoreErrorCode } = {
  NAME_NOT_UNIQUE: 'NAME_NOT_UNIQUE',
  STALE_VERSION: 'STALE_VERSION',
  HAS_INBOUND_REFS: 'HAS_INBOUND_REFS',
  ILLEGAL_RELATION: 'ILLEGAL_RELATION',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  INVALID_OPERATION: 'INVALID_OPERATION',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  WORKING_COPY_NOT_FOUND: 'WORKING_COPY_NOT_FOUND',
  COMMIT_CONFLICT: 'COMMIT_CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

export type WorkerErrorCode = CoreErrorCode;

// Use core CommandResult directly for consistency across layers
export type CommandResult = CoreCommandResult;

/**
 * Command event for tracking
 */
export interface CommandEvent {
  commandId: string;
  timestamp: Timestamp;
  correlationId?: string;
  result: CommandResult;
}
