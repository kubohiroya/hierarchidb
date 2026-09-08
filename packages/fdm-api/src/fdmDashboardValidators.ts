import {
  FDM_CELL_STATUSES,
  type FdmCompatibilityNotice,
  type FdmCrossSpaceCellProjection,
  type FdmCrossSpaceViewProjection,
  type FdmDashboardCell,
  type FdmDashboardConnectionState,
  type FdmDashboardDimensions,
  type FdmDashboardNormalizationResult,
  type FdmDashboardResponse,
  type FdmDimensionValue,
  type FdmDirectoryEntry,
  type FdmForkParentProvenanceProjection,
  type FdmResultLocation,
  type FdmRulesetGovernanceProjection,
  type FdmRuntimeEvent,
  type FdmSnapshotRef,
  type FdmWorkflowNextAction,
  type FdmWorkflowOperationOutcome,
  type FdmWorkflowOperationProjection,
  type FdmWorkflowOperationStatus,
  type FdmWorkflowProjection,
  type FdmWorkflowStatus,
} from './fdmDashboardTypes.js';
import type { FdmAxisDimension, FdmProjectionAvailability } from './fdmTypes.js';
import { FdmContractError } from './fdmTypes.js';
import { assertFdmFilters, assertFdmNodeData } from './fdmValidators.js';

const CONNECTION_STATES = new Set<FdmDashboardConnectionState>([
  'connected',
  'reconnecting',
  'disconnected',
  'stale',
]);
const CELL_STATUSES = new Set<string>(FDM_CELL_STATUSES);
const DIRECTORY_KINDS = new Set(['directory', 'file', 'result']);
const PROJECTION_AVAILABILITY = new Set<FdmProjectionAvailability>([
  'available',
  'unavailable',
  'stale',
  'unsupported',
]);
const WORKFLOW_STATUSES = new Set<FdmWorkflowStatus>([
  'CREATED',
  'PREFLIGHT_FAILED',
  'RUNNING',
  'DIAGNOSING',
  'WAITING_FOR_AGENT',
  'RECHECKING_REPAIR',
  'WAITING_FOR_HUMAN',
  'COMPLETED',
  'COMPLETED_WITH_WAIVER',
  'ABORTED',
  'CANCELLED',
  'VERIFYING_REPAIR',
  'COMPLETE',
]);
const WORKFLOW_OPERATION_STATUSES = new Set<FdmWorkflowOperationStatus>([
  'PENDING',
  'READY',
  'RUNNING',
  'TERMINAL',
  'UNKNOWN_AFTER_INTERRUPTION',
]);
const WORKFLOW_OPERATION_OUTCOMES = new Set<FdmWorkflowOperationOutcome>([
  'SUCCEEDED',
  'DRIFTED',
  'MISSING_ARTIFACT',
  'UNSUPPORTED_CAPABILITY',
  'EXECUTION_FAILED',
  'CANCELLED',
  'SKIPPED',
]);
const WORKFLOW_NEXT_ACTIONS = new Set<FdmWorkflowNextAction>([
  'await-dependency',
  'complete-workflow',
  'execute-operation',
  'request-agent-work',
  'rerun-producer',
  'run-diagnosis',
  'retry-operation',
]);
const FORBIDDEN_DASHBOARD_KEYS = [
  'endpoint',
  'endpointUrl',
  'graphqlUrl',
  'webSocketUrl',
  'token',
  'jwt',
  'authToken',
  'credential',
  'credentials',
  'password',
  'absolutePath',
  'serverPath',
  'rawPath',
  'csvText',
  'tabularRows',
] as const;

export function assertFdmDashboardResponse(value: unknown): asserts value is FdmDashboardResponse {
  assertNormalizedFdmDashboardResponse(value);
}

export function normalizeFdmDashboardResponse(value: unknown): FdmDashboardNormalizationResult {
  const record = assertRecord(value, 'FDM dashboard response');
  rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'FDM dashboard response');
  const notices: FdmCompatibilityNotice[] = [];
  const dimensions = normalizeDimensions(record.dimensions, notices);
  const cells = normalizeCells(record.cells, notices);
  const response = {
    ...record,
    dimensions,
    cells,
    compatibility: [...readCompatibilityNotices(record.compatibility), ...notices],
  };
  assertNormalizedFdmDashboardResponse(response);
  return {
    response: response as unknown as FdmDashboardResponse,
    notices,
  };
}

function assertNormalizedFdmDashboardResponse(
  value: unknown
): asserts value is FdmDashboardResponse {
  const record = assertRecord(value, 'FDM dashboard response');
  rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'FDM dashboard response');
  assertFdmNodeData(record.node);
  assertConnectionState(record.connectionState);
  assertNonEmptyString(record.spaceLabel, 'spaceLabel');
  assertStringArray(record.stateDirectories, 'stateDirectories');
  if (record.selectedStateDir !== undefined) {
    assertNonEmptyString(record.selectedStateDir, 'selectedStateDir');
  }
  assertDimensions(record.dimensions);
  assertCellArray(record.cells, record.dimensions);
  assertRuntimeEvents(record.runtimeEvents);
  assertStringArray(record.logs, 'logs');
  assertDirectoryEntries(record.directoryEntries);
  assertResultLocations(record.resultLocations);
  assertWorkflowProjection(record.workflow);
  assertRulesetGovernanceProjection(record.ruleset);
  assertCrossSpaceViewProjection(record.crossSpace);
  assertNonEmptyString(record.refreshedAt, 'refreshedAt');
  assertCompatibilityNotices(record.compatibility);
}

export function summarizeFdmCells(cells: readonly FdmDashboardCell[]) {
  const summary = {
    totalCells: cells.length,
    succeeded: 0,
    running: 0,
    failed: 0,
    blocked: 0,
  };
  for (const cell of cells) {
    if (cell.status === 'succeeded') summary.succeeded += 1;
    if (cell.status === 'running') summary.running += 1;
    if (cell.status === 'failed') summary.failed += 1;
    if (cell.status === 'blocked') summary.blocked += 1;
  }
  return summary;
}

export function filterFdmCells(cells: readonly FdmDashboardCell[], filters: unknown) {
  assertFdmFilters(filters);
  return cells.filter((cell) => {
    return (
      matchesFilter(filters.parameterSets, cell.parameterSet) &&
      matchesFilter(filters.datasets, cell.dataset) &&
      matchesFilter(filters.computes, cell.compute) &&
      matchesFilter(filters.timelines, cell.timeline) &&
      matchesFilter(filters.rangeProfiles ?? [], cell.rangeProfile ?? '')
    );
  });
}

export function projectFdmCellAxisKey(cell: FdmDashboardCell, axis: unknown): string {
  assertAxisDimension(axis);
  if (axis === 'parameterSet') return cell.parameterSet;
  if (axis === 'profile') return cell.profile ?? cell.parameterSet;
  if (axis === 'dataset') return cell.dataset;
  if (axis === 'timeline') return cell.timeline;
  if (axis === 'checkpoint') return cell.checkpoint ?? cell.timeline;
  return cell.compute;
}

function assertDimensions(value: unknown): asserts value is FdmDashboardDimensions {
  const record = assertRecord(value, 'dimensions');
  assertDimensionValueArray(record.parameterSets, 'dimensions.parameterSets');
  assertDimensionValueArray(record.datasets, 'dimensions.datasets');
  assertDimensionValueArray(record.computes, 'dimensions.computes');
  assertDimensionValueArray(record.timelines, 'dimensions.timelines');
  for (const collection of ['profiles', 'checkpoints', 'rangeProfiles', 'snapshots'] as const) {
    if (record[collection] !== undefined) {
      assertDimensionValueArray(record[collection], `dimensions.${collection}`);
    }
  }
}

function assertDimensionValueArray(
  value: unknown,
  fieldName: string
): asserts value is readonly FdmDimensionValue[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError(`${fieldName} must be an array`);
  }
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, fieldName);
    assertNonEmptyString(record.id, `${fieldName}.id`);
    assertNonEmptyString(record.label, `${fieldName}.label`);
    if (ids.has(record.id)) {
      throw new FdmContractError(`${fieldName} contains duplicated id`);
    }
    ids.add(record.id);
  }
}

function assertCellArray(
  value: unknown,
  dimensions: FdmDashboardDimensions
): asserts value is readonly FdmDashboardCell[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('cells must be an array');
  }
  const parameterSets = idsOf(dimensions.parameterSets);
  const datasets = idsOf(dimensions.datasets);
  const computes = idsOf(dimensions.computes);
  const timelines = idsOf(dimensions.timelines);
  const profiles = idsOf(dimensions.profiles ?? dimensions.parameterSets);
  const checkpoints = idsOf(dimensions.checkpoints ?? dimensions.timelines);
  const rangeProfiles = idsOf(dimensions.rangeProfiles ?? []);
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, 'cell');
    rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'cell');
    assertNonEmptyString(record.id, 'cell.id');
    if (ids.has(record.id)) {
      throw new FdmContractError('cells contain duplicated id');
    }
    ids.add(record.id);
    assertDimensionMember(record.parameterSet, parameterSets, 'cell.parameterSet');
    assertDimensionMember(record.dataset, datasets, 'cell.dataset');
    assertDimensionMember(record.compute, computes, 'cell.compute');
    assertDimensionMember(record.timeline, timelines, 'cell.timeline');
    if (record.profile !== undefined)
      assertDimensionMember(record.profile, profiles, 'cell.profile');
    if (record.checkpoint !== undefined) {
      assertDimensionMember(record.checkpoint, checkpoints, 'cell.checkpoint');
    }
    if (record.rangeProfile !== undefined) {
      assertDimensionMember(record.rangeProfile, rangeProfiles, 'cell.rangeProfile');
    }
    assertCellStatus(record.status, 'cell.status');
    if (record.updatedAt !== undefined) assertNonEmptyString(record.updatedAt, 'cell.updatedAt');
    if (record.message !== undefined) assertNonEmptyString(record.message, 'cell.message');
    assertOptionalProgress(record.progress);
    if (record.resultRef !== undefined) assertNonEmptyString(record.resultRef, 'cell.resultRef');
    if (record.snapshot !== undefined) assertSnapshotRef(record.snapshot, 'cell.snapshot');
  }
}

function assertRuntimeEvents(value: unknown): asserts value is readonly FdmRuntimeEvent[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('runtimeEvents must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'runtimeEvent');
    assertNonEmptyString(record.id, 'runtimeEvent.id');
    if (record.cellId !== undefined) assertNonEmptyString(record.cellId, 'runtimeEvent.cellId');
    assertCellStatus(record.status, 'runtimeEvent.status');
    assertNonEmptyString(record.message, 'runtimeEvent.message');
    assertNonEmptyString(record.occurredAt, 'runtimeEvent.occurredAt');
  }
}

function assertDirectoryEntries(value: unknown): asserts value is readonly FdmDirectoryEntry[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('directoryEntries must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'directoryEntry');
    rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'directoryEntry');
    assertNonEmptyString(record.id, 'directoryEntry.id');
    assertNonEmptyString(record.label, 'directoryEntry.label');
    if (typeof record.kind !== 'string' || !DIRECTORY_KINDS.has(record.kind)) {
      throw new FdmContractError('directoryEntry.kind is invalid');
    }
    assertStringArray(record.logicalPath, 'directoryEntry.logicalPath');
    if (record.resultRef !== undefined) {
      assertNonEmptyString(record.resultRef, 'directoryEntry.resultRef');
    }
  }
}

function assertResultLocations(value: unknown): asserts value is readonly FdmResultLocation[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('resultLocations must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'resultLocation');
    assertNonEmptyString(record.cellId, 'resultLocation.cellId');
    assertNonEmptyString(record.label, 'resultLocation.label');
    assertFiniteNumber(record.longitude, 'resultLocation.longitude');
    assertFiniteNumber(record.latitude, 'resultLocation.latitude');
    assertCellStatus(record.status, 'resultLocation.status');
    const longitude = record.longitude;
    const latitude = record.latitude;
    if (longitude < -180 || longitude > 180) {
      throw new FdmContractError('resultLocation.longitude is out of range');
    }
    if (latitude < -90 || latitude > 90) {
      throw new FdmContractError('resultLocation.latitude is out of range');
    }
  }
}

function assertWorkflowProjection(
  value: unknown
): asserts value is FdmWorkflowProjection | undefined {
  if (value === undefined) return;
  const record = assertRecord(value, 'workflow');
  assertProjectionAvailability(record.availability, 'workflow.availability');
  if (record.workflowId !== undefined)
    assertNonEmptyString(record.workflowId, 'workflow.workflowId');
  if (record.status !== undefined) assertWorkflowStatus(record.status, 'workflow.status');
  if (record.nextAction !== undefined)
    assertWorkflowNextAction(record.nextAction, 'workflow.nextAction');
  if (record.operations !== undefined) assertWorkflowOperations(record.operations);
  assertProjectionOrigin(record.origin, 'workflow.origin');
  if (record.message !== undefined) assertNonEmptyString(record.message, 'workflow.message');
  if (record.updatedAt !== undefined) assertNonEmptyString(record.updatedAt, 'workflow.updatedAt');
}

function assertWorkflowOperations(
  value: unknown
): asserts value is readonly FdmWorkflowOperationProjection[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('workflow.operations must be an array');
  }
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, 'workflow operation');
    assertNonEmptyString(record.id, 'workflow.operation.id');
    if (ids.has(record.id)) {
      throw new FdmContractError('workflow.operations contains duplicated id');
    }
    ids.add(record.id);
    if (record.label !== undefined) assertNonEmptyString(record.label, 'workflow.operation.label');
    assertWorkflowOperationStatus(record.status, 'workflow.operation.status');
    if (record.outcome !== undefined) {
      assertWorkflowOperationOutcome(record.outcome, 'workflow.operation.outcome');
    }
    if (record.nextAction !== undefined) {
      assertWorkflowNextAction(record.nextAction, 'workflow.operation.nextAction');
    }
    if (record.message !== undefined)
      assertNonEmptyString(record.message, 'workflow.operation.message');
    if (record.updatedAt !== undefined)
      assertNonEmptyString(record.updatedAt, 'workflow.operation.updatedAt');
  }
}

function assertRulesetGovernanceProjection(
  value: unknown
): asserts value is FdmRulesetGovernanceProjection | undefined {
  if (value === undefined) return;
  const record = assertRecord(value, 'ruleset');
  assertProjectionAvailability(record.availability, 'ruleset.availability');
  if (record.rulesetId !== undefined) assertNonEmptyString(record.rulesetId, 'ruleset.rulesetId');
  if (record.version !== undefined) assertNonEmptyString(record.version, 'ruleset.version');
  if (record.fingerprint !== undefined)
    assertNonEmptyString(record.fingerprint, 'ruleset.fingerprint');
  if (record.digest !== undefined) assertNonEmptyString(record.digest, 'ruleset.digest');
  if (record.acceptedKnownIssues !== undefined) {
    assertAcceptedKnownIssues(record.acceptedKnownIssues);
  }
  assertProjectionOrigin(record.origin, 'ruleset.origin');
  if (record.message !== undefined) assertNonEmptyString(record.message, 'ruleset.message');
  if (record.updatedAt !== undefined) assertNonEmptyString(record.updatedAt, 'ruleset.updatedAt');
}

function assertCrossSpaceViewProjection(
  value: unknown
): asserts value is FdmCrossSpaceViewProjection | undefined {
  if (value === undefined) return;
  const record = assertRecord(value, 'crossSpace');
  assertProjectionAvailability(record.availability, 'crossSpace.availability');
  if (record.readOnly !== true) {
    throw new FdmContractError('crossSpace.readOnly must be true');
  }
  if (record.viewId !== undefined) assertNonEmptyString(record.viewId, 'crossSpace.viewId');
  assertProjectionOrigin(record.origin, 'crossSpace.origin');
  if (record.cells !== undefined) assertCrossSpaceCells(record.cells);
  if (record.forks !== undefined) assertForkParentProvenance(record.forks);
  if (record.message !== undefined) assertNonEmptyString(record.message, 'crossSpace.message');
  if (record.updatedAt !== undefined)
    assertNonEmptyString(record.updatedAt, 'crossSpace.updatedAt');
}

function assertCrossSpaceCells(
  value: unknown
): asserts value is readonly FdmCrossSpaceCellProjection[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('crossSpace.cells must be an array');
  }
  const ids = new Set<string>();
  for (const entry of value) {
    const record = assertRecord(entry, 'cross-space cell');
    assertNonEmptyString(record.cellId, 'crossSpace.cells.cellId');
    if (ids.has(record.cellId)) {
      throw new FdmContractError('crossSpace.cells contains duplicated cellId');
    }
    ids.add(record.cellId);
    if (record.label !== undefined) assertNonEmptyString(record.label, 'crossSpace.cells.label');
    if (record.origin === undefined) {
      throw new FdmContractError('crossSpace.cells.origin is required');
    }
    assertProjectionOrigin(record.origin, 'crossSpace.cells.origin');
    if (record.status !== undefined) assertCellStatus(record.status, 'crossSpace.cells.status');
    if (record.snapshot !== undefined)
      assertSnapshotRef(record.snapshot, 'crossSpace.cells.snapshot');
    if (record.message !== undefined)
      assertNonEmptyString(record.message, 'crossSpace.cells.message');
  }
}

function assertForkParentProvenance(
  value: unknown
): asserts value is readonly FdmForkParentProvenanceProjection[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('crossSpace.forks must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'fork provenance');
    assertProjectionAvailability(record.availability, 'crossSpace.forks.availability');
    if (record.origin === undefined) {
      throw new FdmContractError('crossSpace.forks.origin is required');
    }
    assertProjectionOrigin(record.origin, 'crossSpace.forks.origin');
    if (record.forkSpaceId !== undefined)
      assertNonEmptyString(record.forkSpaceId, 'crossSpace.forks.forkSpaceId');
    if (record.parentSpaceId !== undefined)
      assertNonEmptyString(record.parentSpaceId, 'crossSpace.forks.parentSpaceId');
    if (record.manifestRef !== undefined)
      assertNonEmptyString(record.manifestRef, 'crossSpace.forks.manifestRef');
    if (record.commit !== undefined) assertNonEmptyString(record.commit, 'crossSpace.forks.commit');
    if (record.message !== undefined)
      assertNonEmptyString(record.message, 'crossSpace.forks.message');
    if (record.updatedAt !== undefined)
      assertNonEmptyString(record.updatedAt, 'crossSpace.forks.updatedAt');
  }
}

function assertAcceptedKnownIssues(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new FdmContractError('ruleset.acceptedKnownIssues must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'accepted known issue');
    if (record.issueNumber !== undefined) {
      assertPositiveInteger(record.issueNumber, 'ruleset.acceptedKnownIssues.issueNumber');
    }
    if (record.issueUrl !== undefined) {
      assertNonEmptyString(record.issueUrl, 'ruleset.acceptedKnownIssues.issueUrl');
    }
    if (record.reason !== undefined) {
      assertNonEmptyString(record.reason, 'ruleset.acceptedKnownIssues.reason');
    }
  }
}

function assertConnectionState(value: unknown): asserts value is FdmDashboardConnectionState {
  if (typeof value !== 'string' || !CONNECTION_STATES.has(value as FdmDashboardConnectionState)) {
    throw new FdmContractError('connectionState is invalid');
  }
}

function assertProjectionAvailability(
  value: unknown,
  fieldName: string
): asserts value is FdmProjectionAvailability {
  if (
    typeof value !== 'string' ||
    !PROJECTION_AVAILABILITY.has(value as FdmProjectionAvailability)
  ) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertProjectionOrigin(value: unknown, fieldName: string): void {
  if (value === undefined) return;
  const record = assertRecord(value, fieldName);
  assertNonEmptyString(record.spaceId, `${fieldName}.spaceId`);
  if (record.baselineSpaceId !== undefined) {
    assertNonEmptyString(record.baselineSpaceId, `${fieldName}.baselineSpaceId`);
  }
  if (record.forkParentSpaceId !== undefined) {
    assertNonEmptyString(record.forkParentSpaceId, `${fieldName}.forkParentSpaceId`);
  }
  if (record.source !== undefined) assertNonEmptyString(record.source, `${fieldName}.source`);
}

function assertWorkflowStatus(
  value: unknown,
  fieldName: string
): asserts value is FdmWorkflowStatus {
  if (typeof value !== 'string' || !WORKFLOW_STATUSES.has(value as FdmWorkflowStatus)) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertWorkflowOperationStatus(
  value: unknown,
  fieldName: string
): asserts value is FdmWorkflowOperationStatus {
  if (
    typeof value !== 'string' ||
    !WORKFLOW_OPERATION_STATUSES.has(value as FdmWorkflowOperationStatus)
  ) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertWorkflowOperationOutcome(
  value: unknown,
  fieldName: string
): asserts value is FdmWorkflowOperationOutcome {
  if (
    typeof value !== 'string' ||
    !WORKFLOW_OPERATION_OUTCOMES.has(value as FdmWorkflowOperationOutcome)
  ) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertWorkflowNextAction(
  value: unknown,
  fieldName: string
): asserts value is FdmWorkflowNextAction {
  if (typeof value !== 'string' || !WORKFLOW_NEXT_ACTIONS.has(value as FdmWorkflowNextAction)) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertCellStatus(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || !CELL_STATUSES.has(value)) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function assertAxisDimension(value: unknown): asserts value is FdmAxisDimension {
  if (
    value !== 'parameterSet' &&
    value !== 'profile' &&
    value !== 'dataset' &&
    value !== 'timeline' &&
    value !== 'checkpoint' &&
    value !== 'compute'
  ) {
    throw new FdmContractError('axis is invalid');
  }
}

function readDimensionArray(value: unknown, fieldName: string): readonly FdmDimensionValue[] {
  assertDimensionValueArray(value, fieldName);
  return value;
}

function normalizeDimensions(
  value: unknown,
  notices: FdmCompatibilityNotice[]
): FdmDashboardDimensions {
  const record = assertRecord(value, 'dimensions');
  const sourceProfiles = record.profiles ?? record.parameterSets;
  const sourceCheckpoints = record.checkpoints ?? record.timelines;
  const profiles = readDimensionArray(sourceProfiles, 'dimensions.profiles');
  const datasets = readDimensionArray(record.datasets, 'dimensions.datasets');
  const computes = readDimensionArray(record.computes, 'dimensions.computes');
  const checkpoints = readDimensionArray(sourceCheckpoints, 'dimensions.checkpoints');
  const parameterSets =
    record.parameterSets === undefined
      ? profiles
      : readDimensionArray(record.parameterSets, 'dimensions.parameterSets');
  const timelines =
    record.timelines === undefined
      ? checkpoints
      : readDimensionArray(record.timelines, 'dimensions.timelines');
  const rangeProfiles =
    record.rangeProfiles === undefined
      ? undefined
      : readDimensionArray(record.rangeProfiles, 'dimensions.rangeProfiles');
  const snapshots =
    record.snapshots === undefined
      ? undefined
      : readDimensionArray(record.snapshots, 'dimensions.snapshots');
  assertDimensionAliasesCompatible(
    profiles,
    parameterSets,
    'dimensions.profiles',
    'dimensions.parameterSets'
  );
  assertDimensionAliasesCompatible(
    checkpoints,
    timelines,
    'dimensions.checkpoints',
    'dimensions.timelines'
  );
  if (record.parameterSets === undefined && profiles.length > 0) {
    notices.push(createNotice('LEGACY_PROFILE_ALIAS', 'dimensions.parameterSets'));
  }
  if (record.profiles === undefined && parameterSets.length > 0) {
    notices.push(createNotice('CANONICAL_PARAMETER_SET_BACKFILL', 'dimensions.profiles'));
  }
  if (record.timelines === undefined && checkpoints.length > 0) {
    notices.push(createNotice('LEGACY_CHECKPOINT_ALIAS', 'dimensions.timelines'));
  }
  if (record.checkpoints === undefined && timelines.length > 0) {
    notices.push(createNotice('CANONICAL_TIMELINE_BACKFILL', 'dimensions.checkpoints'));
  }
  return {
    ...record,
    profiles,
    datasets,
    computes,
    checkpoints,
    parameterSets,
    timelines,
    ...(rangeProfiles === undefined ? {} : { rangeProfiles }),
    ...(snapshots === undefined ? {} : { snapshots }),
  } as FdmDashboardDimensions;
}

function assertDimensionAliasesCompatible(
  legacy: readonly FdmDimensionValue[],
  canonical: readonly FdmDimensionValue[],
  legacyPath: string,
  canonicalPath: string
): void {
  const legacyIds = legacy.map((entry) => entry.id);
  const canonicalIds = canonical.map((entry) => entry.id);
  if (
    legacyIds.length !== canonicalIds.length ||
    legacyIds.some((legacyId, index) => legacyId !== canonicalIds[index])
  ) {
    throw new FdmContractError(`${canonicalPath} conflicts with ${legacyPath}`);
  }
}

function normalizeCells(
  value: unknown,
  notices: FdmCompatibilityNotice[]
): readonly FdmDashboardCell[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError('cells must be an array');
  }
  return value.map((entry, index) => {
    const record = assertRecord(entry, 'cell');
    rejectForbiddenKeys(record, FORBIDDEN_DASHBOARD_KEYS, 'cell');
    const parameterSet = normalizeAlias(
      record.parameterSet,
      record.profile,
      `cells.${index}.parameterSet`,
      `cells.${index}.profile`,
      'CANONICAL_PARAMETER_SET_BACKFILL',
      notices
    );
    const timeline = normalizeAlias(
      record.timeline,
      record.checkpoint,
      `cells.${index}.timeline`,
      `cells.${index}.checkpoint`,
      'CANONICAL_TIMELINE_BACKFILL',
      notices
    );
    const snapshot = normalizeSnapshot(
      record.snapshot,
      timeline,
      record.resultRef,
      `cells.${index}.snapshot`
    );
    return {
      ...record,
      profile: record.profile ?? parameterSet,
      checkpoint: record.checkpoint ?? timeline,
      parameterSet,
      timeline,
      ...(snapshot === undefined ? {} : { snapshot }),
    } as FdmDashboardCell;
  });
}

function normalizeAlias(
  canonical: unknown,
  legacy: unknown,
  canonicalPath: string,
  legacyPath: string,
  noticeCode: FdmCompatibilityNotice['code'],
  notices: FdmCompatibilityNotice[]
): string {
  if (canonical !== undefined && legacy !== undefined && canonical !== legacy) {
    throw new FdmContractError(`${canonicalPath} conflicts with ${legacyPath}`);
  }
  const value = canonical ?? legacy;
  assertNonEmptyString(value, canonicalPath);
  if (canonical === undefined) {
    notices.push(createNotice(noticeCode, canonicalPath));
  }
  return value;
}

function normalizeSnapshot(
  value: unknown,
  timeline: string,
  resultRef: unknown,
  fieldName: string
): FdmSnapshotRef | undefined {
  if (value === undefined) {
    return resultRef === undefined
      ? { timelineId: timeline }
      : { timelineId: timeline, resultRef: `${resultRef}` };
  }
  const record = assertRecord(value, fieldName);
  const timelineId = record.timelineId ?? timeline;
  assertNonEmptyString(timelineId, `${fieldName}.timelineId`);
  if (timelineId !== timeline) {
    throw new FdmContractError(`${fieldName}.timelineId conflicts with cell.timeline`);
  }
  if (record.checkpoint !== undefined) {
    assertNonEmptyString(record.checkpoint, `${fieldName}.checkpoint`);
  }
  if (record.stateDir !== undefined) assertNonEmptyString(record.stateDir, `${fieldName}.stateDir`);
  if (record.resultRef !== undefined)
    assertNonEmptyString(record.resultRef, `${fieldName}.resultRef`);
  return {
    timelineId,
    ...(record.checkpoint === undefined ? {} : { checkpoint: record.checkpoint }),
    ...(record.stateDir === undefined ? {} : { stateDir: record.stateDir }),
    ...(record.resultRef === undefined ? {} : { resultRef: record.resultRef }),
  } as FdmSnapshotRef;
}

function assertSnapshotRef(value: unknown, fieldName: string): asserts value is FdmSnapshotRef {
  const record = assertRecord(value, fieldName);
  assertNonEmptyString(record.timelineId, `${fieldName}.timelineId`);
  if (record.checkpoint !== undefined) {
    assertNonEmptyString(record.checkpoint, `${fieldName}.checkpoint`);
  }
  if (record.stateDir !== undefined) assertNonEmptyString(record.stateDir, `${fieldName}.stateDir`);
  if (record.resultRef !== undefined)
    assertNonEmptyString(record.resultRef, `${fieldName}.resultRef`);
}

function readCompatibilityNotices(value: unknown): readonly FdmCompatibilityNotice[] {
  if (value === undefined) return [];
  assertCompatibilityNotices(value);
  return value;
}

function assertCompatibilityNotices(
  value: unknown
): asserts value is readonly FdmCompatibilityNotice[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new FdmContractError('compatibility must be an array');
  }
  for (const entry of value) {
    const record = assertRecord(entry, 'compatibility notice');
    assertCompatibilityNoticeCode(record.code, 'compatibility.code');
    assertNonEmptyString(record.path, 'compatibility.path');
    assertNonEmptyString(record.message, 'compatibility.message');
  }
}

function assertCompatibilityNoticeCode(
  value: unknown,
  fieldName: string
): asserts value is FdmCompatibilityNotice['code'] {
  if (
    value !== 'LEGACY_PROFILE_ALIAS' &&
    value !== 'LEGACY_CHECKPOINT_ALIAS' &&
    value !== 'CANONICAL_PARAMETER_SET_BACKFILL' &&
    value !== 'CANONICAL_TIMELINE_BACKFILL'
  ) {
    throw new FdmContractError(`${fieldName} is invalid`);
  }
}

function createNotice(code: FdmCompatibilityNotice['code'], path: string): FdmCompatibilityNotice {
  return {
    code,
    path,
    message: `${path} was normalized for the FDM seven-layer compatibility contract`,
  };
}

function assertOptionalProgress(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new FdmContractError('cell.progress must be a finite number from 0 to 100');
  }
}

function assertDimensionMember(value: unknown, members: Set<string>, fieldName: string): void {
  assertNonEmptyString(value, fieldName);
  if (!members.has(value)) {
    throw new FdmContractError(`${fieldName} is not declared in dimensions`);
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is readonly string[] {
  if (!Array.isArray(value)) {
    throw new FdmContractError(`${fieldName} must be an array`);
  }
  for (const entry of value) {
    assertNonEmptyString(entry, fieldName);
  }
}

function assertFiniteNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FdmContractError(`${fieldName} must be a finite number`);
  }
}

function assertPositiveInteger(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new FdmContractError(`${fieldName} must be a positive integer`);
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new FdmContractError(`${fieldName} must be a trimmed non-empty string`);
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new FdmContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectForbiddenKeys(
  record: Record<string, unknown>,
  keys: readonly string[],
  label: string
): void {
  for (const key of keys) {
    if (Object.hasOwn(record, key)) {
      throw new FdmContractError(`${label} must not contain ${key}`);
    }
  }
}

function idsOf(values: readonly FdmDimensionValue[]): Set<string> {
  return new Set(values.map((entry) => entry.id));
}

function matchesFilter(allowed: readonly string[], value: string): boolean {
  return allowed.length === 0 || allowed.includes(value);
}
