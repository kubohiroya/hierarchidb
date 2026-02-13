import type { CommitStatus } from './commit-types.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from './tree-node-types.js';

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export type CommandGroupId = string;
export type CommandId = string;
export type Seq = number;

export type OnNameConflict = 'error' | 'auto-rename' | 'overwrite';

export type ErrorCode =
  | 'NAME_NOT_UNIQUE'
  | 'STALE_VERSION'
  | 'HAS_INBOUND_REFS'
  | 'ILLEGAL_RELATION'
  | 'NODE_NOT_FOUND'
  | 'INVALID_OPERATION'
  | 'UNKNOWN_ERROR'
  | 'WORKING_COPY_NOT_FOUND'
  | 'COMMIT_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR';

type CommitFailureStatus = Exclude<CommitStatus, 'ok'>;

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
        rootIds: NodeId[];
        nodeCount?: number;
      };
      status?: 'ok';
      autoRenameTo?: string;
    }
  | {
      success: false;
      error: string;
      code: ErrorCode;
      seq?: Seq; //  seq
      status?: CommitFailureStatus;
      suggestedName?: string;
      originalVersion?: number;
      wcVersion?: number;
    };

export interface RecoverFromArchivePayload {
  nodeIds: NodeId[];
  toParentId?: NodeId;
  onNameConflict?: OnNameConflict;
}

export type RestoreFromArchivePayload = RecoverFromArchivePayload;


export type TreeChangeEventType =
  | 'node-created'
  | 'node-updated'
  | 'node-deleted'
  | 'node-moved'
  | 'children-changed';
