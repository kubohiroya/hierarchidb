import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type {
  StagedFolderActionType,
  StagedFolderExportArchiveAction,
  StagedFolderExportCsvAction,
  StagedFolderExportXlsxAction,
  StagedFolderImportMountAction,
} from './StagedFolderActionManifestTypes.js';

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

export type StagedFolderActionDependencyChange = {
  edgeId: string;
  previousStatus: 'active' | 'stale' | 'rebuilding' | 'resolved' | 'orphaned';
  nextStatus: 'active' | 'stale' | 'rebuilding' | 'resolved' | 'orphaned';
  artifactId?: string;
  buildTargetId?: NodeId;
  sourceNodeId?: NodeId;
  targetNodeId?: NodeId;
  targetFieldPath?: string;
  rebuildPlanId?: string;
};

export type StagedFolderActionFailureCategory = 'reference' | 'dependency';

export type StagedFolderActionFailure = {
  category: StagedFolderActionFailureCategory;
  code: string;
  message: string;
  nodeId?: NodeId;
  dependentNodeId?: NodeId;
  referencePath?: string;
  expectedTargetType?: string;
  actualTargetType?: string;
  mountId?: string;
  pluginId?: string;
};

export type StagedFolderExportCsvActionResult = {
  type: StagedFolderExportCsvAction['type'];
  status: 'completed';
  outputPath: string;
  entityType: StagedFolderExportCsvAction['entityType'];
  rowCount: number;
};

export type StagedFolderExportXlsxActionResult = {
  type: StagedFolderExportXlsxAction['type'];
  status: 'completed';
  outputPath: string;
  entityType: StagedFolderExportXlsxAction['entityType'];
  rowCount: number;
  sheetName: string;
};

export type StagedFolderExportArchiveActionResult = {
  type: StagedFolderExportArchiveAction['type'];
  status: 'completed';
  outputPath: string;
  format: StagedFolderExportArchiveAction['format'];
  byteLength: number;
  nodeIds: readonly NodeId[];
};

export type StagedFolderImportMountActionResult = {
  type: StagedFolderImportMountAction['type'];
  status: 'completed';
  mountId: string;
  mountedRootNodeId: NodeId;
  importedNodeIds: readonly NodeId[];
  lifetime: StagedFolderImportMountAction['mount']['lifetime'];
};

export type StagedFolderActionResult =
  | StagedFolderExportCsvActionResult
  | StagedFolderExportXlsxActionResult
  | StagedFolderExportArchiveActionResult
  | StagedFolderImportMountActionResult;

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
  dependencyChanges?: readonly StagedFolderActionDependencyChange[];
  actionResults?: readonly StagedFolderActionResult[];
  failure?: StagedFolderActionFailure;
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
  dependencyChanges?: readonly StagedFolderActionDependencyChange[];
  actionResults?: readonly StagedFolderActionResult[];
  failure?: StagedFolderActionFailure;
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
  dependencyChanges: [],
  actionResults: [],
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
  record.dependencyChanges?.forEach(assertDependencyChange);
  record.actionResults?.forEach(assertActionResult);
  if (record.failure !== undefined) {
    assertFailure(record.failure);
  }
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

const assertDependencyChange = (
  change: StagedFolderActionDependencyChange,
  index: number
): void => {
  assertNonEmptyString(change.edgeId, `dependencyChanges[${index}].edgeId`);
  assertDependencyStatus(change.previousStatus, `dependencyChanges[${index}].previousStatus`);
  assertDependencyStatus(change.nextStatus, `dependencyChanges[${index}].nextStatus`);
  assertOptionalNonEmptyString(change.artifactId, `dependencyChanges[${index}].artifactId`);
  assertOptionalNonEmptyString(change.buildTargetId, `dependencyChanges[${index}].buildTargetId`);
  assertOptionalNonEmptyString(change.sourceNodeId, `dependencyChanges[${index}].sourceNodeId`);
  assertOptionalNonEmptyString(change.targetNodeId, `dependencyChanges[${index}].targetNodeId`);
  assertOptionalNonEmptyString(
    change.targetFieldPath,
    `dependencyChanges[${index}].targetFieldPath`
  );
  assertOptionalNonEmptyString(change.rebuildPlanId, `dependencyChanges[${index}].rebuildPlanId`);
};

const assertDependencyStatus = (value: string, field: string): void => {
  if (
    value !== 'active' &&
    value !== 'stale' &&
    value !== 'rebuilding' &&
    value !== 'resolved' &&
    value !== 'orphaned'
  ) {
    throw new Error(`staged-folder-action progress ${field} is invalid`);
  }
};

const assertFailure = (failure: StagedFolderActionFailure): void => {
  if (failure.category !== 'reference' && failure.category !== 'dependency') {
    throw new Error('staged-folder-action failure.category is invalid');
  }
  assertNonEmptyString(failure.code, 'failure.code');
  assertNonEmptyString(failure.message, 'failure.message');
  assertOptionalNonEmptyString(failure.nodeId, 'failure.nodeId');
  assertOptionalNonEmptyString(failure.dependentNodeId, 'failure.dependentNodeId');
  assertOptionalNonEmptyString(failure.referencePath, 'failure.referencePath');
  assertOptionalNonEmptyString(failure.expectedTargetType, 'failure.expectedTargetType');
  assertOptionalNonEmptyString(failure.actualTargetType, 'failure.actualTargetType');
  assertOptionalNonEmptyString(failure.mountId, 'failure.mountId');
  assertOptionalNonEmptyString(failure.pluginId, 'failure.pluginId');
};

const assertActionResult = (result: StagedFolderActionResult, index: number): void => {
  if (result.status !== 'completed') {
    throw new Error(`staged-folder-action actionResults[${index}].status must be completed`);
  }
  if (result.type === 'export-archive') {
    assertNonEmptyString(result.outputPath, `actionResults[${index}].outputPath`);
    if (result.format !== 'canonical-yaml-zip') {
      throw new Error(`staged-folder-action actionResults[${index}].format is invalid`);
    }
    assertNonNegativeInteger(result.byteLength, `actionResults[${index}].byteLength`);
    assertNodeIdArray(result.nodeIds, `actionResults[${index}].nodeIds`);
    return;
  }
  if (result.type === 'import-mount') {
    assertNonEmptyString(result.mountId, `actionResults[${index}].mountId`);
    assertNonEmptyString(result.mountedRootNodeId, `actionResults[${index}].mountedRootNodeId`);
    assertNodeIdArray(result.importedNodeIds, `actionResults[${index}].importedNodeIds`);
    assertMountLifetime(result.lifetime, `actionResults[${index}].lifetime`);
    return;
  }
  assertNonEmptyString(result.outputPath, `actionResults[${index}].outputPath`);
  assertNonNegativeInteger(result.rowCount, `actionResults[${index}].rowCount`);
  assertEntityType(result.entityType, `actionResults[${index}].entityType`);
  if (result.type === 'export-xlsx') {
    assertSheetName(result.sheetName, `actionResults[${index}].sheetName`);
    return;
  }
  if (result.type !== 'export-csv') {
    throw new Error(`staged-folder-action actionResults[${index}].type is invalid`);
  }
};

const assertNodeIdArray = (value: readonly NodeId[], field: string): void => {
  if (!Array.isArray(value)) {
    throw new Error(`staged-folder-action progress ${field} must be an array`);
  }
  value.forEach((nodeId, index) => {
    assertNonEmptyString(nodeId, `${field}[${index}]`);
  });
};

const assertMountLifetime = (value: string, field: string): void => {
  if (value !== 'run' && value !== 'retain' && value !== 'permanent') {
    throw new Error(`staged-folder-action progress ${field} is invalid`);
  }
};

const assertEntityType = (value: string, field: string): void => {
  if (value !== 'location' && value !== 'route') {
    throw new Error(`staged-folder-action progress ${field} is invalid`);
  }
};

const assertSheetName = (value: string, field: string): void => {
  assertNonEmptyString(value, field);
  if (value.length > 31 || /[:\\/?*[\]]/.test(value)) {
    throw new Error(`staged-folder-action progress ${field} must be a valid Excel worksheet name`);
  }
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
