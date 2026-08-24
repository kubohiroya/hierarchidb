import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { StagedFolderActionType } from './StagedFolderActionManifestTypes.js';

export const STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE = 'staged-folder-action' as NodeType;

export type StagedFolderActionRunStatus =
  | 'starting'
  | 'running'
  | 'paused'
  | 'auth-required'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StagedFolderActionRunPhase =
  | 'validating-config'
  | 'preparing-staging'
  | 'applying-overlay'
  | 'resolving-references'
  | 'running-action'
  | 'waiting-build-session'
  | 'writing-output'
  | 'cleanup'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'auth-required';

export interface StagedFolderActionCurrentActionProgress {
  actionIndex: number;
  actionType: StagedFolderActionType;
  phase: string;
  percentage: number;
}

export interface StagedFolderActionProgressCounts {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
}

export type StagedFolderActionReferenceWarning = {
  category: 'reference';
  code: string;
  message: string;
  nodeId?: string;
  dependentNodeId?: string;
  referencePath?: string;
  expectedTargetType?: string;
  actualTargetType?: string;
  actionIndex?: number;
  actionType?: string;
  mountId?: string;
  pluginId?: string;
};

export type StagedFolderActionPendingReference = {
  status: 'pending' | 'resolved';
  code: string;
  nodeId?: string;
  dependentNodeId?: string;
  referencePath: string;
  expectedTargetType?: string;
  resolvedTargetNodeId?: string;
  actionIndex?: number;
  actionType?: string;
  mountId?: string;
  pluginId?: string;
};

export interface StagedFolderActionRunRecord {
  runId: NodeId;
  sourceNodeId: NodeId;
  stagingRootNodeId?: NodeId;
  status: StagedFolderActionRunStatus;
  phase: StagedFolderActionRunPhase;
  progress: StagedFolderActionProgressCounts;
  currentAction?: StagedFolderActionCurrentActionProgress;
  buildSession?: {
    nodeType: NodeType;
    nodeId: NodeId;
    status: string;
    targets?: Array<{
      nodeType: NodeType;
      nodeId: NodeId;
      status: string;
    }>;
  };
  warnings?: readonly StagedFolderActionReferenceWarning[];
  pendingReferences?: readonly StagedFolderActionPendingReference[];
  error?: string;
  startedAt: number;
  completedAt?: number;
  updatedAt: number;
  revision: number;
}

export type CreateStagedFolderActionRunRecordInput = {
  runId: NodeId;
  sourceNodeId: NodeId;
  stagingRootNodeId?: NodeId;
  now: number;
};

export type StagedFolderActionRunRecordPatch = {
  status?: StagedFolderActionRunStatus;
  phase?: StagedFolderActionRunPhase;
  progress?: StagedFolderActionProgressCounts;
  currentAction?: StagedFolderActionCurrentActionProgress;
  buildSession?: StagedFolderActionRunRecord['buildSession'];
  warnings?: readonly StagedFolderActionReferenceWarning[];
  pendingReferences?: readonly StagedFolderActionPendingReference[];
  stagingRootNodeId?: NodeId;
  error?: string;
  completedAt?: number;
  updatedAt: number;
};

export const createStagedFolderActionRunRecord = ({
  runId,
  sourceNodeId,
  stagingRootNodeId,
  now,
}: CreateStagedFolderActionRunRecordInput): StagedFolderActionRunRecord => ({
  runId,
  sourceNodeId,
  stagingRootNodeId,
  status: 'starting',
  phase: 'validating-config',
  progress: {
    total: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    percentage: 0,
  },
  warnings: [],
  pendingReferences: [],
  startedAt: now,
  updatedAt: now,
  revision: 0,
});

export const updateStagedFolderActionRunRecord = (
  record: StagedFolderActionRunRecord,
  patch: StagedFolderActionRunRecordPatch
): StagedFolderActionRunRecord => {
  const next: StagedFolderActionRunRecord = {
    ...record,
    ...patch,
    progress: patch.progress ?? record.progress,
    revision: record.revision + 1,
  };
  assertStagedFolderActionRunRecord(next);
  return next;
};

export const assertStagedFolderActionRunRecord = (
  record: StagedFolderActionRunRecord
): StagedFolderActionRunRecord => {
  assertNonNegativeInteger(record.revision, 'revision');
  assertFinitePercentage(record.progress.percentage, 'progress.percentage');
  assertNonNegativeInteger(record.progress.total, 'progress.total');
  assertNonNegativeInteger(record.progress.completed, 'progress.completed');
  assertNonNegativeInteger(record.progress.failed, 'progress.failed');
  assertNonNegativeInteger(record.progress.skipped, 'progress.skipped');
  if (record.currentAction !== undefined) {
    assertNonNegativeInteger(record.currentAction.actionIndex, 'currentAction.actionIndex');
    assertFinitePercentage(record.currentAction.percentage, 'currentAction.percentage');
  }
  record.warnings?.forEach(assertReferenceWarning);
  record.pendingReferences?.forEach(assertPendingReference);
  return record;
};

const assertFinitePercentage = (value: number, field: string): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`staged-folder-action progress ${field} must be a finite number in 0..100`);
  }
};

const assertNonNegativeInteger = (value: number, field: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`staged-folder-action progress ${field} must be a non-negative integer`);
  }
};

const assertReferenceWarning = (
  warning: StagedFolderActionReferenceWarning,
  index: number
): void => {
  if (warning.category !== 'reference') {
    throw new Error(`staged-folder-action warning[${index}].category must be reference`);
  }
  assertNonEmptyString(warning.code, `warnings[${index}].code`);
  assertNonEmptyString(warning.message, `warnings[${index}].message`);
  assertOptionalNonEmptyString(warning.referencePath, `warnings[${index}].referencePath`);
};

const assertPendingReference = (
  reference: StagedFolderActionPendingReference,
  index: number
): void => {
  if (reference.status !== 'pending' && reference.status !== 'resolved') {
    throw new Error(`staged-folder-action pendingReferences[${index}].status is invalid`);
  }
  assertNonEmptyString(reference.code, `pendingReferences[${index}].code`);
  assertNonEmptyString(reference.referencePath, `pendingReferences[${index}].referencePath`);
  assertOptionalNonEmptyString(
    reference.resolvedTargetNodeId,
    `pendingReferences[${index}].resolvedTargetNodeId`
  );
};

const assertOptionalNonEmptyString = (value: string | undefined, field: string): void => {
  if (value === undefined) return;
  assertNonEmptyString(value, field);
};

const assertNonEmptyString = (value: string, field: string): void => {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    throw new Error(`staged-folder-action progress ${field} must be a non-empty trimmed string`);
  }
};
