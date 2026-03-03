import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from './NODE_TYPES.js';

export type CommitStatus = 'ok' | 'COMMIT_CONFLICT' | 'NAME_CONFLICT';

export type CommitOkResult = {
  status: 'ok';
  nodeId: NodeId;
  node?: TreeNode;
  autoRenameTo?: string;
};

export type CommitConflictResult = {
  status: 'COMMIT_CONFLICT';
  originalVersion: number;
  wcVersion: number;
};

export type CommitNameConflictResult = {
  status: 'NAME_CONFLICT';
  suggestedName: string;
};

export type CommitResult = CommitOkResult | CommitConflictResult | CommitNameConflictResult;
