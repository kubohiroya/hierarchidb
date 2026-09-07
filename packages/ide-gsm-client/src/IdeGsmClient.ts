import { GraphQLClient } from 'graphql-request';
import type { Client as WsClient } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import type {
  IdeGsmDirectoryInfoReport,
  IdeGsmDirectoryNode,
  IdeGsmDirectoryTreeReport,
  IdeGsmFdmDirectoryInfoInput,
  IdeGsmFdmDirectoryRemoveInput,
  IdeGsmFdmDirectoryRemoveReport,
  IdeGsmFdmDirectoryTreeInput,
  IdeGsmFdmSpace,
  IdeGsmFdmSpaceCreateInput,
  IdeGsmFdmSpaceDefaults,
  IdeGsmFdmSpaceDeleteInput,
  IdeGsmFdmSpaceDeleteReport,
  IdeGsmFdmSpacesReport,
  IdeGsmFdmSpaceUpdateInput,
  IdeGsmProjectDirectoryInfoReport,
  IdeGsmProjectDirectoryInput,
  IdeGsmProjectDirectoryTreeReport,
} from './ideGsmDirectoryTypes.js';
import {
  assertLogicalPath,
  assertProjectRelativePath as assertMountProjectRelativePath,
} from './ideGsmDirectoryTypes.js';
import { ideGsmGraphqlDocuments } from './ideGsmGraphqlDocuments.js';
import type {
  ActiveProjectTask,
  ActiveProjectTaskStatus,
  CalibrateCommandInput,
  ConditionalProjectYamlWriteInput,
  ConditionalProjectYamlWriteResult,
  ExportFilter,
  FdmBaseline,
  FdmCapabilitiesPayload,
  FdmCapability,
  FdmCellDetailInput,
  FdmCellDetailPayload,
  FdmCellLogInput,
  FdmCellLogListener,
  FdmCellLogStreamPayload,
  FdmCellStageIdentity,
  FdmDashboardCell,
  FdmDashboardLivePayload,
  FdmDashboardStartupStatus,
  FdmDashboardStatePayload,
  FdmDashboardStatusInput,
  FdmDashboardStatusPayload,
  FdmFork,
  FdmJob,
  FdmLifecycleDiagnostic,
  FdmLifecycleInput,
  FdmLineage,
  FdmLockStatus,
  FdmRecoveredStateDiagnostics,
  FdmRuleset,
  FdmRun,
  FdmRunOperation,
  FdmRuntimeBackendType,
  FdmRuntimeDiagnosticsInput,
  FdmRuntimeDiagnosticsPayload,
  FdmRuntimeEventListener,
  FdmRuntimeEventPayload,
  FdmRuntimeEventsInput,
  FdmRuntimePhase,
  FdmVerifyInput,
  FdmVerifyReport,
  FdmWorkflow,
  IdeGsmCommand,
  IdeGsmFdmResolvedPathContext,
  InstallCommandInput,
  PreviewEventsCommandInput,
  ProjectFileContentPage,
  ProjectFileContentPageInput,
  ProjectFileContentTransfer,
  ProjectFileContentTransferInput,
  ProjectYamlFileContent,
  ProjectYamlFileContentInput,
  ProjectYamlWriteStatus,
  RemoteCalibrateCommandInput,
  RemoteSimulateCommandInput,
  RsyncConnectionType,
  RsyncFilter,
  SimulateCommandInput,
  TaskCancelResult,
  TaskLogEvent,
  TaskLogListener,
  TaskResult,
  TaskStatus,
  TaskStatusListener,
} from './ideGsmTypes.js';
import { IDE_GSM_COMMAND_IDS } from './ideGsmTypes.js';

/** Factory type for creating a graphql-ws client. Injected for testability. */
export type WsClientFactory = (url: string, connectionParams: Record<string, string>) => WsClient;

const TASK_STATUSES: ReadonlySet<string> = new Set<TaskStatus>([
  'REGISTERED',
  'READY',
  'LEASED',
  'FINISHED',
  'FAILED',
  'CANCELED',
  'DELETED',
]);
const IDE_GSM_COMMAND_ID_SET: ReadonlySet<string> = new Set(IDE_GSM_COMMAND_IDS);

const ACTIVE_PROJECT_TASK_STATUSES: ReadonlySet<string> = new Set<ActiveProjectTaskStatus>([
  'REGISTERED',
  'READY',
  'LEASED',
  'FINISHED',
  'FAILED',
  'CANCELED',
]);
const ACTIVE_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['REGISTERED', 'READY', 'LEASED']);
const PROJECT_YAML_WRITE_STATUSES: ReadonlySet<string> = new Set<ProjectYamlWriteStatus>([
  'UPDATED',
  'CONTENT_CONFLICT',
  'FILE_LOCK_UNAVAILABLE',
  'ATOMIC_REPLACE_UNAVAILABLE',
  'AUTHORIZATION_FAILED',
]);
const FDM_RUNTIME_BACKEND_TYPES: ReadonlySet<string> = new Set<FdmRuntimeBackendType>([
  'API',
  'BATCH',
  'EC2',
  'LOCAL',
  'MCP',
  'REMOTE',
  'SSH',
]);
const FDM_RUNTIME_PHASES: ReadonlySet<string> = new Set<FdmRuntimePhase>([
  'ACCEPTED',
  'CANCELED',
  'FAILED',
  'PROGRESS',
  'STARTED',
  'SUCCEEDED',
]);
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;
const YAML_PATH_PATTERN = /\.ya?ml$/u;
const CSV_PATH_PATTERN = /\.csv$/u;
const CSV_TRANSFER_CHUNK_SIZE_BYTES = 16_384;

type ReportDocumentName =
  | 'fdmSpaces'
  | 'fdmDirectoryTree'
  | 'fdmDirectoryInfo'
  | 'fdmDirectoryRemove'
  | 'fdmSpaceCreate'
  | 'fdmSpaceUpdate'
  | 'fdmSpaceDelete'
  | 'fdmDashboardStatus'
  | 'fdmCellDetail'
  | 'fdmRuntimeDiagnostics'
  | 'fdmCapabilities'
  | 'fdmWorkflow'
  | 'fdmWorkflows'
  | 'fdmRun'
  | 'fdmRuns'
  | 'fdmJob'
  | 'fdmJobs'
  | 'fdmRunCancel'
  | 'fdmJobCancel'
  | 'projectDirectoryTree'
  | 'projectDirectoryInfo'
  | 'projectYamlFileContent'
  | 'beginProjectFileContentTransfer'
  | 'projectFileContentPage'
  | 'closeProjectFileContentTransfer'
  | 'conditionalProjectYamlWrite'
  | 'activeProjectTasks'
  | 'cancelTask'
  | 'fdmVerify'
  | 'fdmSweep';

type TaskMutationName = Exclude<
  keyof typeof ideGsmGraphqlDocuments,
  | ReportDocumentName
  | 'subscribeTask'
  | 'subscribeTaskLog'
  | 'subscribeFdmCellLog'
  | 'subscribeFdmRuntimeEvents'
>;

interface SubscribeTaskEvent {
  subscribeTaskOnFrontend?: unknown;
}

interface SubscribeTaskLogEvent {
  subscribeTaskLog?: unknown;
}

interface SubscribeFdmCellLogEvent {
  subscribeFdmCellLog?: unknown;
}

interface SubscribeFdmRuntimeEventsEvent {
  subscribeFdmRuntimeEvents?: unknown;
}

function buildAuthHeaders(authToken: string): Record<string, string> {
  return { Authorization: `Bearer ${authToken}` };
}

function assertProjectRelativePath(projectRelativePath: string): void {
  assertMountProjectRelativePath(projectRelativePath);
}

function assertConnectionType(
  connectionType: string
): asserts connectionType is RsyncConnectionType {
  if (connectionType !== 'remote' && connectionType !== 'ssh' && connectionType !== 'ec2') {
    throw new Error('connectionType must be remote, ssh, or ec2');
  }
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

function addDefined(variables: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) {
    variables[key] = value;
  }
}

function assertOptionalNonNegativeInteger(value: number | undefined, fieldName: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
}

function fdmDirectoryVariables(
  input?: IdeGsmFdmDirectoryTreeInput | IdeGsmFdmDirectoryInfoInput
): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  if (input?.spaceId !== undefined) {
    assertNonEmpty(input.spaceId, 'spaceId');
    variables.spaceId = input.spaceId;
  }
  if (input?.path !== undefined) {
    assertLogicalPath(input.path, 'path', true);
    variables.path = input.path;
  }
  assertOptionalNonNegativeInteger(input?.depth, 'depth');
  addDefined(variables, 'depth', input?.depth);
  return variables;
}

function fdmSpaceCreateVariables(input: IdeGsmFdmSpaceCreateInput): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  if (input.spaceId !== undefined) {
    assertNonEmpty(input.spaceId, 'spaceId');
    variables.spaceId = input.spaceId;
  }
  if (input.label !== undefined) {
    assertNonEmpty(input.label, 'label');
    variables.label = input.label;
  }
  addDefined(variables, 'defaultSpace', input.defaultSpace);
  return variables;
}

function fdmSpaceUpdateVariables(input: IdeGsmFdmSpaceUpdateInput): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  const variables: Record<string, unknown> = { spaceId: input.spaceId };
  if (input.label !== undefined) {
    assertNonEmpty(input.label, 'label');
    variables.label = input.label;
  }
  addDefined(variables, 'visible', input.visible);
  addDefined(variables, 'archived', input.archived);
  addDefined(variables, 'defaultSpace', input.defaultSpace);
  addDefined(variables, 'order', input.order);
  return variables;
}

function fdmSpaceDeleteVariables(input: IdeGsmFdmSpaceDeleteInput): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  const variables: Record<string, unknown> = { spaceId: input.spaceId };
  addDefined(variables, 'apply', input.apply);
  addDefined(variables, 'deleteFiles', input.deleteFiles);
  addDefined(variables, 'confirmation', input.confirmation);
  return variables;
}

function projectDirectoryVariables(input: IdeGsmProjectDirectoryInput): Record<string, unknown> {
  const variables = projectVariables(input.projectRelativePath);
  if (input.path !== undefined) {
    assertLogicalPath(input.path, 'path', true);
    variables.path = input.path;
  }
  assertOptionalNonNegativeInteger(input.depth, 'depth');
  addDefined(variables, 'depth', input.depth);
  return variables;
}

function assertProjectYamlFilePath(relativePath: string): void {
  assertMountProjectRelativePath(relativePath);
  if (!YAML_PATH_PATTERN.test(relativePath)) {
    throw new Error('relativePath must point to a YAML file');
  }
}

function assertProjectCsvFilePath(relativePath: string): void {
  assertMountProjectRelativePath(relativePath);
  if (!CSV_PATH_PATTERN.test(relativePath)) {
    throw new Error('relativePath must point to a CSV file');
  }
}

function assertSha256Digest(expectedDigest: string): void {
  if (!SHA256_HEX_PATTERN.test(expectedDigest)) {
    throw new Error('expectedDigest must be a 64-character lowercase SHA-256 hex string');
  }
}

function projectYamlFileVariables(input: ProjectYamlFileContentInput): Record<string, unknown> {
  const variables = projectVariables(input.projectRelativePath);
  assertProjectYamlFilePath(input.relativePath);
  variables.relativePath = input.relativePath;
  return variables;
}

function projectCsvFileVariables(input: ProjectFileContentTransferInput): Record<string, unknown> {
  const variables = projectVariables(input.projectRelativePath);
  assertProjectCsvFilePath(input.relativePath);
  variables.relativePath = input.relativePath;
  return variables;
}

function projectFileContentPageVariables(
  input: ProjectFileContentPageInput
): Record<string, unknown> {
  assertNonEmpty(input.transferId, 'transferId');
  const variables: Record<string, unknown> = { transferId: input.transferId };
  if (input.cursor !== undefined) {
    assertNonEmpty(input.cursor, 'cursor');
    variables.cursor = input.cursor;
  }
  return variables;
}

function assertStringArray(value: readonly string[] | undefined, fieldName: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
}

function fdmDashboardStatusVariables(input: FdmDashboardStatusInput): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  const variables: Record<string, unknown> = { spaceId: input.spaceId };
  addDefined(variables, 'parameterSet', input.parameterSet);
  addDefined(variables, 'profile', input.profile);
  addDefined(variables, 'dataset', input.dataset);
  addDefined(variables, 'compute', input.compute);
  addDefined(variables, 'timeline', input.timeline);
  addDefined(variables, 'stateDir', input.stateDir);
  return variables;
}

function fdmCellVariables(input: FdmCellDetailInput | FdmCellLogInput): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  assertNonEmpty(input.parameterSet, 'parameterSet');
  assertNonEmpty(input.dataset, 'dataset');
  assertNonEmpty(input.compute, 'compute');
  assertNonEmpty(input.timelinePoint, 'timelinePoint');
  const variables: Record<string, unknown> = {
    spaceId: input.spaceId,
    parameterSet: input.parameterSet,
    dataset: input.dataset,
    compute: input.compute,
    timelinePoint: input.timelinePoint,
  };
  addDefined(variables, 'label', input.label);
  addDefined(variables, 'stateDir', input.stateDir);
  return variables;
}

function fdmRuntimeDiagnosticsVariables(
  input: FdmRuntimeDiagnosticsInput
): Record<string, unknown> {
  return projectVariables(input.projectRelativePath);
}

function fdmRuntimeEventsVariables(input: FdmRuntimeEventsInput): Record<string, unknown> {
  const variables = projectVariables(input.projectRelativePath);
  addDefined(variables, 'stateDir', input.stateDir);
  return variables;
}

function fdmVerifyVariables(input: FdmVerifyInput): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  assertStringArray(input.parameterSet, 'parameterSet');
  assertStringArray(input.profile, 'profile');
  assertStringArray(input.dataset, 'dataset');
  assertStringArray(input.computeEngine, 'computeEngine');
  assertStringArray(input.timeline, 'timeline');
  assertStringArray(input.sources, 'sources');
  assertStringArray(input.targetComputes, 'targetComputes');
  assertStringArray(input.compatibleSnapshotCommits, 'compatibleSnapshotCommits');
  assertStringArray(input.compatibleSnapshotRevisions, 'compatibleSnapshotRevisions');
  assertStringArray(input.axisPriority, 'axisPriority');
  const variables: Record<string, unknown> = { spaceId: input.spaceId };
  addDefined(variables, 'planName', input.planName);
  addDefined(variables, 'parameterSet', input.parameterSet);
  addDefined(variables, 'profile', input.profile);
  addDefined(variables, 'dataset', input.dataset);
  addDefined(variables, 'computeEngine', input.computeEngine);
  addDefined(variables, 'timeline', input.timeline);
  addDefined(variables, 'sources', input.sources);
  addDefined(variables, 'stateDir', input.stateDir);
  addDefined(variables, 'defaultCompute', input.defaultCompute);
  addDefined(variables, 'targetComputes', input.targetComputes);
  addDefined(variables, 'baselineCompute', input.baselineCompute);
  addDefined(variables, 'compareSelectors', input.compareSelectors);
  addDefined(variables, 'tolerance', input.tolerance);
  addDefined(variables, 'toleranceProfile', input.toleranceProfile);
  addDefined(variables, 'snapshotLevel', input.snapshotLevel);
  addDefined(variables, 'snapshotPolicy', input.snapshotPolicy);
  addDefined(variables, 'compatibleSnapshotCommits', input.compatibleSnapshotCommits);
  addDefined(variables, 'compatibleSnapshotRevisions', input.compatibleSnapshotRevisions);
  addDefined(variables, 'axisPriority', input.axisPriority);
  addDefined(variables, 'benchmarkAggregateMode', input.benchmarkAggregateMode);
  addDefined(variables, 'remoteInventoryFile', input.remoteInventoryFile);
  addDefined(variables, 'remoteLabel', input.remoteLabel);
  addDefined(variables, 'sshProfile', input.sshProfile);
  addDefined(variables, 'originalSourceParameterSet', input.originalSourceParameterSet);
  addDefined(variables, 'originalSourceProfile', input.originalSourceProfile);
  addDefined(variables, 'originalSourceProjectDir', input.originalSourceProjectDir);
  addDefined(variables, 'preflight', input.preflight);
  return variables;
}

function fdmLifecycleVariables(input: FdmLifecycleInput): Record<string, unknown> {
  const variables: Record<string, unknown> = {};
  addDefined(variables, 'spaceId', input.spaceId);
  addDefined(variables, 'workflowId', input.workflowId);
  addDefined(variables, 'runId', input.runId);
  addDefined(variables, 'jobId', input.jobId);
  addDefined(variables, 'taskId', input.taskId);
  addDefined(variables, 'operationId', input.operationId);
  addDefined(variables, 'stateDir', input.stateDir);
  addDefined(variables, 'executionKind', input.executionKind);
  return variables;
}

function fdmLifecycleCancelVariables(input: FdmLifecycleInput): Record<string, unknown> {
  const variables = fdmLifecycleVariables(input);
  if (
    variables.workflowId === undefined &&
    variables.runId === undefined &&
    variables.jobId === undefined &&
    variables.taskId === undefined
  ) {
    throw new Error('workflowId, runId, jobId, or taskId is required');
  }
  return variables;
}

function conditionalProjectYamlWriteVariables(
  input: ConditionalProjectYamlWriteInput
): Record<string, unknown> {
  const variables = projectYamlFileVariables(input);
  assertSha256Digest(input.expectedDigest);
  if (typeof input.content !== 'string') {
    throw new Error('content must be a string');
  }
  variables.expectedDigest = input.expectedDigest;
  variables.content = input.content;
  return variables;
}

function fdmDirectoryRemoveVariables(
  input: IdeGsmFdmDirectoryRemoveInput
): Record<string, unknown> {
  assertNonEmpty(input.spaceId, 'spaceId');
  assertLogicalPath(input.path, 'path', false);
  if (typeof input.apply !== 'boolean') {
    throw new Error('apply must be a boolean');
  }
  return {
    spaceId: input.spaceId,
    path: input.path,
    apply: input.apply,
  };
}

function projectVariables(projectRelativePath: string): Record<string, unknown> {
  assertProjectRelativePath(projectRelativePath);
  return { projectRelativePath };
}

function simulateVariables(
  projectRelativePath: string,
  options?: Omit<SimulateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = projectVariables(projectRelativePath);
  addDefined(variables, 'profile', options?.profile);
  addDefined(variables, 'compute', options?.compute);
  addDefined(variables, 'apsp', options?.apsp);
  addDefined(variables, 'purgeCache', options?.purgeCache);
  addDefined(variables, 'reset', options?.reset);
  return variables;
}

function calibrateVariables(
  projectRelativePath: string,
  options?: Omit<CalibrateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = simulateVariables(projectRelativePath, options);
  addDefined(variables, 'purgeCalib', options?.purgeCalib);
  return variables;
}

function remoteSimulateVariables(
  projectRelativePath: string,
  options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = projectVariables(projectRelativePath);
  addDefined(variables, 'compute', options?.compute);
  addDefined(variables, 'apsp', options?.apsp);
  addDefined(variables, 'purgeCache', options?.purgeCache);
  addDefined(variables, 'reset', options?.reset);
  addDefined(variables, 'downloadCache', options?.downloadCache);
  return variables;
}

function remoteCalibrateVariables(
  projectRelativePath: string,
  options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
): Record<string, unknown> {
  const variables = remoteSimulateVariables(projectRelativePath, options);
  addDefined(variables, 'purgeCalib', options?.purgeCalib);
  return variables;
}

function parseTaskResult(value: unknown): TaskResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('IDE-GSM task subscription returned a malformed event');
  }

  const event = value as Record<string, unknown>;
  if (
    typeof event.id !== 'string' ||
    typeof event.status !== 'string' ||
    !TASK_STATUSES.has(event.status) ||
    typeof event.paramsJson !== 'string' ||
    (event.resultJson !== null && typeof event.resultJson !== 'string')
  ) {
    throw new Error('IDE-GSM task subscription returned a malformed event');
  }

  return {
    id: event.id,
    status: event.status as TaskStatus,
    paramsJson: event.paramsJson,
    resultJson: event.resultJson,
    runId: readOptionalNullableScalarString(event, 'runId'),
    jobId: readOptionalNullableScalarString(event, 'jobId'),
    workflowId: readOptionalNullableScalarString(event, 'workflowId'),
    executionKind: readOptionalNullableScalarString(event, 'executionKind'),
  };
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value !== null && typeof value !== 'string') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readOptionalNullableScalarString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error('IDE-GSM GraphQL response malformed');
}

function readOptionalNullableStringArray(
  record: Record<string, unknown>,
  key: string
): string[] | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readNullableFiniteNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readNullableNonNegativeIntegerScalar(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return parsed;
}

function readNonNegativeIntegerScalar(record: Record<string, unknown>, key: string): number {
  const value = readNullableNonNegativeIntegerScalar(record, key);
  if (value === null) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readServerTimestampString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === 'string') {
    if (/^\d+$/u.test(value)) {
      const millis = Number(value);
      if (!Number.isSafeInteger(millis)) {
        throw new Error('IDE-GSM GraphQL response malformed');
      }
      return new Date(millis).toISOString();
    }
    return value;
  }
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return new Date(value).toISOString();
  }
  throw new Error('IDE-GSM GraphQL response malformed');
}

function readNullableServerTimestampString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return readServerTimestampString(record, key);
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readDigest(record: Record<string, unknown>, key: string): string {
  const digest = readString(record, key);
  if (!SHA256_HEX_PATTERN.test(digest)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return digest;
}

function readSha256Digest(record: Record<string, unknown>, key: string): string {
  const digest = readDigest(record, key);
  return digest;
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string): number {
  const value = readFiniteNumber(record, key);
  if (value < 0) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readNullableNonNegativeNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  if (value === null) return null;
  return readNonNegativeNumber(record, key);
}

function readOptionalNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readOptionalNullableBoolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function readNullableProgress(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (value === null) return null;
  const progress = readFiniteNumber(record, key);
  if (progress < 0 || progress > 100) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return progress;
}

function parseDirectoryNode(value: unknown): IdeGsmDirectoryNode {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const rawChildren = value.children;
  if (!Array.isArray(rawChildren)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    name: readString(value, 'name'),
    relativePath: readString(value, 'relativePath'),
    kind: readString(value, 'kind'),
    directory: readBoolean(value, 'directory'),
    exists: readBoolean(value, 'exists'),
    sizeBytes: readFiniteNumber(value, 'sizeBytes'),
    updatedAt: readNullableString(value, 'updatedAt'),
    childCount: readFiniteNumber(value, 'childCount'),
    children: rawChildren.map(parseDirectoryNode),
  };
}

function parseDirectoryTreeReport(value: unknown): IdeGsmDirectoryTreeReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    selectedPath: readString(value, 'selectedPath'),
    maxDepth: readFiniteNumber(value, 'maxDepth'),
    root: parseDirectoryNode(value.root),
  };
}

function parseDirectoryInfoReport(value: unknown): IdeGsmDirectoryInfoReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    requestedPath: readString(value, 'requestedPath'),
    descendantCount: readFiniteNumber(value, 'descendantCount'),
    node: parseDirectoryNode(value.node),
  };
}

function parseFdmSpacesReport(value: unknown): IdeGsmFdmSpacesReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  if (!Array.isArray(value.spaces)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    defaultSpaceId: readString(value, 'defaultSpaceId'),
    spaces: value.spaces.map(parseFdmSpace),
  };
}

function parseFdmSpace(value: unknown): IdeGsmFdmSpace {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    spaceId: readString(value, 'spaceId'),
    ...(Object.hasOwn(value, 'label') ? { label: readOptionalNullableString(value, 'label') } : {}),
    ...(Object.hasOwn(value, 'defaultSpace')
      ? { defaultSpace: readOptionalNullableBoolean(value, 'defaultSpace') }
      : {}),
    ...(Object.hasOwn(value, 'visible')
      ? { visible: readOptionalNullableBoolean(value, 'visible') }
      : {}),
    ...(Object.hasOwn(value, 'archived')
      ? { archived: readOptionalNullableBoolean(value, 'archived') }
      : {}),
    ...(Object.hasOwn(value, 'owner') ? { owner: readOptionalNullableString(value, 'owner') } : {}),
    ...(Object.hasOwn(value, 'layoutVersion')
      ? { layoutVersion: readOptionalNullableString(value, 'layoutVersion') }
      : {}),
    ...(Object.hasOwn(value, 'legacyRoot')
      ? { legacyRoot: readOptionalNullableBoolean(value, 'legacyRoot') }
      : {}),
    ...(Object.hasOwn(value, 'order')
      ? { order: readNullableNonNegativeIntegerScalar(value, 'order') }
      : {}),
    ...(Object.hasOwn(value, 'createdAt')
      ? { createdAt: readOptionalNullableString(value, 'createdAt') }
      : {}),
    ...(Object.hasOwn(value, 'defaults')
      ? { defaults: parseFdmSpaceDefaults(value.defaults) }
      : {}),
    ...(Object.hasOwn(value, 'warnings')
      ? { warnings: readOptionalNullableStringArray(value, 'warnings') }
      : {}),
  };
}

function parseFdmSpaceDefaults(value: unknown): IdeGsmFdmSpaceDefaults | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    profile: readOptionalNullableStringArray(value, 'profile'),
    dataset: readOptionalNullableStringArray(value, 'dataset'),
    compute: readOptionalNullableStringArray(value, 'compute'),
    timeline: readOptionalNullableStringArray(value, 'timeline'),
  };
}

function parseFdmSpaceDeleteReport(value: unknown): IdeGsmFdmSpaceDeleteReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    apply: readBoolean(value, 'apply'),
    archived: readBoolean(value, 'archived'),
    byteCount: readNonNegativeIntegerScalar(value, 'byteCount'),
    confirmed: readBoolean(value, 'confirmed'),
    deleted: readBoolean(value, 'deleted'),
    fileCount: readNonNegativeIntegerScalar(value, 'fileCount'),
    physicalDelete: readBoolean(value, 'physicalDelete'),
    spaceId: readNullableString(value, 'spaceId'),
    spaces:
      value.spaces === undefined || value.spaces === null
        ? null
        : parseFdmSpacesReport(value.spaces),
    topLevelEntries: readOptionalNullableStringArray(value, 'topLevelEntries'),
  };
}

function parseProjectDirectoryTreeReport(value: unknown): IdeGsmProjectDirectoryTreeReport {
  const report = parseDirectoryTreeReport(value);
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    ...report,
    projectRelativePath: readString(value, 'projectRelativePath'),
  };
}

function parseProjectDirectoryInfoReport(value: unknown): IdeGsmProjectDirectoryInfoReport {
  const report = parseDirectoryInfoReport(value);
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    ...report,
    projectRelativePath: readString(value, 'projectRelativePath'),
  };
}

function parseProjectYamlFileContent(value: unknown): ProjectYamlFileContent {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    projectRelativePath: readString(value, 'projectRelativePath'),
    relativePath: readString(value, 'relativePath'),
    content: readString(value, 'content'),
    contentDigest: readDigest(value, 'contentDigest'),
    updatedAt: readString(value, 'updatedAt'),
    byteCount: readNonNegativeNumber(value, 'byteCount'),
  };
}

function parseConditionalProjectYamlWriteResult(value: unknown): ConditionalProjectYamlWriteResult {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const status = readString(value, 'status');
  if (!PROJECT_YAML_WRITE_STATUSES.has(status)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    status: status as ProjectYamlWriteStatus,
    projectRelativePath: readString(value, 'projectRelativePath'),
    relativePath: readString(value, 'relativePath'),
    contentDigest: value.contentDigest === null ? null : readDigest(value, 'contentDigest'),
    updatedAt: readNullableString(value, 'updatedAt'),
    byteCount: readNullableNonNegativeNumber(value, 'byteCount'),
    resyncRequired: readBoolean(value, 'resyncRequired'),
  };
}

function decodeBase64Bytes(value: string): Uint8Array {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  try {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
}

function parseProjectFileContentTransfer(value: unknown): ProjectFileContentTransfer {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const transfer = {
    transferId: readString(value, 'transferId'),
    contentDigest: readSha256Digest(value, 'contentDigest'),
    updatedAt: readString(value, 'updatedAt'),
    byteCount: readNonNegativeNumber(value, 'byteCount'),
    chunkSizeBytes: readNonNegativeNumber(value, 'chunkSizeBytes'),
    expiresAt: readString(value, 'expiresAt'),
  };
  if (
    transfer.transferId.length === 0 ||
    transfer.chunkSizeBytes !== CSV_TRANSFER_CHUNK_SIZE_BYTES
  ) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return transfer;
}

function parseProjectFileContentPage(value: unknown): ProjectFileContentPage {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const contentChunkBase64 = readString(value, 'contentChunkBase64');
  const rawByteCount = readNonNegativeNumber(value, 'rawByteCount');
  const nextCursor = readNullableString(value, 'nextCursor');
  const hasNext = readBoolean(value, 'hasNext');
  const bytes = decodeBase64Bytes(contentChunkBase64);
  if (
    rawByteCount > CSV_TRANSFER_CHUNK_SIZE_BYTES ||
    bytes.byteLength !== rawByteCount ||
    (hasNext && nextCursor === null) ||
    (!hasNext && nextCursor !== null)
  ) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    contentChunkBase64,
    rawByteCount,
    nextCursor,
    hasNext,
  };
}

function parseActiveProjectTask(value: unknown): ActiveProjectTask {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const status = readString(value, 'status');
  if (!ACTIVE_PROJECT_TASK_STATUSES.has(status)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    taskId: readString(value, 'taskId'),
    commandId: readIdeGsmCommandId(value),
    status: status as ActiveProjectTaskStatus,
    projectRelativePath: readString(value, 'projectRelativePath'),
    progress: readNullableProgress(value, 'progress'),
    phase: readOptionalNullableString(value, 'phase'),
    registeredAt: readServerTimestampString(value, 'registeredAt'),
    startedAt: readNullableServerTimestampString(value, 'startedAt'),
    updatedAt: readServerTimestampString(value, 'updatedAt'),
    runId: readOptionalNullableScalarString(value, 'runId'),
    jobId: readOptionalNullableScalarString(value, 'jobId'),
    workflowId: readOptionalNullableScalarString(value, 'workflowId'),
    executionKind: readOptionalNullableScalarString(value, 'executionKind'),
  };
}

function parseActiveProjectTasks(value: unknown): ActiveProjectTask[] {
  if (!Array.isArray(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value.map(parseActiveProjectTask);
}

function parseTaskCancelResult(value: unknown): TaskCancelResult {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    taskId: readString(value, 'taskId'),
    accepted: readBoolean(value, 'accepted'),
  };
}

function parseTaskLogEvent(value: unknown): TaskLogEvent {
  assertRecord(value, 'IDE-GSM task log subscription returned a malformed event');
  const stream = readString(value, 'stream');
  if (stream !== 'stdout' && stream !== 'stderr' && stream !== 'system') {
    throw new Error('IDE-GSM task log subscription returned a malformed event');
  }
  return {
    taskId: readString(value, 'taskId'),
    sequence: readNonNegativeNumber(value, 'sequence'),
    timestamp: readString(value, 'timestamp'),
    stream,
    text: readString(value, 'text'),
  };
}

function readIdeGsmCommandId(record: Record<string, unknown>): IdeGsmCommand['id'] {
  const commandId = readString(record, 'commandId');
  if (!IDE_GSM_COMMAND_ID_SET.has(commandId)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return commandId as IdeGsmCommand['id'];
}

function parseFdmDirectoryRemoveReport(value: unknown): IdeGsmFdmDirectoryRemoveReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    targetPath: readString(value, 'targetPath'),
    apply: readBoolean(value, 'apply'),
    existed: readBoolean(value, 'existed'),
    deleted: readBoolean(value, 'deleted'),
    deletedFiles: readFiniteNumber(value, 'deletedFiles'),
    deletedBytes: readFiniteNumber(value, 'deletedBytes'),
    target: parseDirectoryNode(value.target),
  };
}

function parseEntryMap(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined || value === null) return {};
  if (!Array.isArray(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  const entries: Record<string, string> = {};
  for (const entry of value) {
    assertRecord(entry, 'IDE-GSM GraphQL response malformed');
    entries[readString(entry, 'key')] = readString(entry, 'value');
  }
  return entries;
}

function parseNullableArray<T>(value: unknown, parser: (entry: unknown) => T): T[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value.map(parser);
}

function parseFdmCellStageIdentity(value: unknown): FdmCellStageIdentity | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    parameterSet: readNullableString(value, 'parameterSet'),
    profile: readNullableString(value, 'profile'),
    dataset: readNullableString(value, 'dataset'),
    compute: readNullableString(value, 'compute'),
    timelinePoint: readNullableString(value, 'timelinePoint'),
    checkpoint: readNullableString(value, 'checkpoint'),
    label: readNullableString(value, 'label'),
    source: readNullableString(value, 'source'),
  };
}

function parseFdmLockStatus(value: unknown): FdmLockStatus | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    active: readBoolean(value, 'active'),
    acquiredAt: readNullableString(value, 'acquiredAt'),
    ageMillis: readNullableNonNegativeIntegerScalar(value, 'ageMillis'),
    fileName: readNullableString(value, 'fileName'),
    host: readNullableString(value, 'host'),
    owner: readNullableString(value, 'owner'),
    pid: readNullableNonNegativeIntegerScalar(value, 'pid'),
    role: readNullableString(value, 'role'),
    staleMetadata: readBoolean(value, 'staleMetadata'),
  };
}

function parseFdmDashboardStartupStatus(value: unknown): FdmDashboardStartupStatus | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    ready: readBoolean(value, 'ready'),
    phase: readNullableString(value, 'phase'),
    startedAt: readNullableString(value, 'startedAt'),
    finishedAt: readNullableString(value, 'finishedAt'),
    waitedMillis: readNonNegativeIntegerScalar(value, 'waitedMillis'),
    waitingForHolder: readNullableString(value, 'waitingForHolder'),
    apiStartupLock: parseFdmLockStatus(value.apiStartupLock),
    simulatorLock: parseFdmLockStatus(value.simulatorLock),
  };
}

function parseFdmDashboardStatePayload(value: unknown): FdmDashboardStatePayload | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return { status: readNullableString(value, 'status') };
}

function parseFdmDashboardLivePayload(value: unknown): FdmDashboardLivePayload | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    status: readNullableString(value, 'status'),
    startedAt: readNullableString(value, 'startedAt'),
  };
}

function parseFdmDashboardCell(value: unknown): FdmDashboardCell {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    parameterSet: readNullableString(value, 'parameterSet'),
    profile: readNullableString(value, 'profile'),
    dataset: readNullableString(value, 'dataset'),
    compute: readNullableString(value, 'compute'),
    timelinePoint: readNullableString(value, 'timelinePoint'),
    checkpoint: readNullableString(value, 'checkpoint'),
    label: readNullableString(value, 'label'),
    source: readNullableString(value, 'source'),
    bucket: readNullableString(value, 'bucket'),
    rawStatus: readNullableString(value, 'rawStatus'),
    accuracyLabel: readNullableString(value, 'accuracyLabel'),
    summaryFile: readNullableString(value, 'summaryFile'),
    current: readBoolean(value, 'current'),
    next: readBoolean(value, 'next'),
    blockingDrift: readBoolean(value, 'blockingDrift'),
    variantCount: readNonNegativeIntegerScalar(value, 'variantCount'),
  };
}

function parseNullableFdmDashboardCells(value: unknown): FdmDashboardCell[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value.map(parseFdmDashboardCell);
}

function parseFdmDashboardStatusPayload(value: unknown): FdmDashboardStatusPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    generatedAt: readNullableString(value, 'generatedAt'),
    selectedSpaceId: readNullableString(value, 'selectedSpaceId'),
    selectedStateDir: readNullableString(value, 'selectedStateDir'),
    availableStateDirs: readOptionalNullableStringArray(value, 'availableStateDirs'),
    parameterSet: readOptionalNullableStringArray(value, 'parameterSet'),
    profile: readOptionalNullableStringArray(value, 'profile'),
    dataset: readOptionalNullableStringArray(value, 'dataset'),
    compute: readOptionalNullableStringArray(value, 'compute'),
    timeline: readOptionalNullableStringArray(value, 'timeline'),
    state: parseFdmDashboardStatePayload(value.state),
    live: parseFdmDashboardLivePayload(value.live),
    startup: parseFdmDashboardStartupStatus(value.startup),
    cells: parseNullableFdmDashboardCells(value.cells),
  };
}

function parseFdmCellDetailPayload(value: unknown): FdmCellDetailPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    generatedAt: readNullableString(value, 'generatedAt'),
    selectedStateDir: readNullableString(value, 'selectedStateDir'),
    stage: parseFdmCellStageIdentity(value.stage),
    startedAt: readNullableString(value, 'startedAt'),
    updatedAt: readNullableString(value, 'updatedAt'),
    finishedAt: readNullableString(value, 'finishedAt'),
    elapsedMs: readNullableNonNegativeIntegerScalar(value, 'elapsedMs'),
    estimatedRemainingMs: readNullableNonNegativeIntegerScalar(value, 'estimatedRemainingMs'),
    estimatedCompletedAt: readNullableString(value, 'estimatedCompletedAt'),
    logPath: readNullableString(value, 'logPath'),
    latestLogLines: readOptionalNullableStringArray(value, 'latestLogLines'),
  };
}

function parseFdmCellLogStreamPayload(value: unknown): FdmCellLogStreamPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    generatedAt: readNullableString(value, 'generatedAt'),
    stage: parseFdmCellStageIdentity(value.stage),
    logPath: readNullableString(value, 'logPath'),
    latestLogLines: readOptionalNullableStringArray(value, 'latestLogLines'),
  };
}

function parseFdmRuntimeBackendType(value: string | null): FdmRuntimeBackendType | null {
  if (value === null) return null;
  if (!FDM_RUNTIME_BACKEND_TYPES.has(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value as FdmRuntimeBackendType;
}

function parseFdmRuntimePhase(value: string | null): FdmRuntimePhase | null {
  if (value === null) return null;
  if (!FDM_RUNTIME_PHASES.has(value)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value as FdmRuntimePhase;
}

function parseFdmRuntimeEventPayload(value: unknown): FdmRuntimeEventPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const progress = readNullableFiniteNumber(value, 'progress');
  if (progress !== null && (progress < 0 || progress > 100)) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    backendType: parseFdmRuntimeBackendType(readNullableString(value, 'backendType')),
    command: readNullableString(value, 'command'),
    compute: readNullableString(value, 'compute'),
    connectionType: readNullableString(value, 'connectionType'),
    message: readNullableString(value, 'message'),
    phase: parseFdmRuntimePhase(readNullableString(value, 'phase')),
    progress,
    projectRelativePath: readNullableString(value, 'projectRelativePath'),
    receivedAt: readNullableString(value, 'receivedAt'),
    recovered: readBoolean(value, 'recovered'),
    taskId: readNullableString(value, 'taskId'),
    username: readNullableString(value, 'username'),
    backendMetadata: parseEntryMap(value.backendMetadata),
  };
}

function parseFdmRecoveredStateDiagnostics(value: unknown): FdmRecoveredStateDiagnostics {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    command: readNullableString(value, 'command'),
    compute: readNullableString(value, 'compute'),
    connectionType: readNullableString(value, 'connectionType'),
    launchLogFile: readNullableString(value, 'launchLogFile'),
    launchPid: readNullableString(value, 'launchPid'),
    launchPlanName: readNullableString(value, 'launchPlanName'),
    liveStatus: readNullableString(value, 'liveStatus'),
    message: readNullableString(value, 'message'),
    phase: readNullableString(value, 'phase'),
    recovered: readBoolean(value, 'recovered'),
    runtimeIdentity: readNullableString(value, 'runtimeIdentity'),
    stateDir: readNullableString(value, 'stateDir'),
    taskId: readNullableString(value, 'taskId'),
  };
}

function parseFdmRuntimeDiagnosticsPayload(value: unknown): FdmRuntimeDiagnosticsPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  const recoveredStates = value.recoveredStates;
  if (
    recoveredStates !== undefined &&
    recoveredStates !== null &&
    !Array.isArray(recoveredStates)
  ) {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return {
    generatedAt: readNullableString(value, 'generatedAt'),
    startup: parseFdmDashboardStartupStatus(value.startup),
    recoveredStates:
      recoveredStates === undefined || recoveredStates === null
        ? null
        : recoveredStates.map(parseFdmRecoveredStateDiagnostics),
  };
}

function parseFdmResolvedPathContext(value: unknown): IdeGsmFdmResolvedPathContext | null {
  if (value === undefined || value === null) return null;
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    allowedProjectRoots: readOptionalNullableStringArray(value, 'allowedProjectRoots'),
    allowedProjectRootsSource: readNullableString(value, 'allowedProjectRootsSource'),
    fdmDirectory: readNullableString(value, 'fdmDirectory'),
    fdmDirectorySource: readNullableString(value, 'fdmDirectorySource'),
    fixtureDirectory: readNullableString(value, 'fixtureDirectory'),
    fixtureDirectorySource: readNullableString(value, 'fixtureDirectorySource'),
  };
}

function parseFdmVerifyReport(value: unknown): FdmVerifyReport {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    axisPriority: readOptionalNullableStringArray(value, 'axisPriority'),
    baselineCompute: readNullableString(value, 'baselineCompute'),
    benchmarkAggregateMode: readNullableString(value, 'benchmarkAggregateMode'),
    calibrationRuntimeOptions: parseEntryMap(value.calibrationRuntimeOptions),
    command: readOptionalNullableStringArray(value, 'command'),
    compareSelectors: readNullableString(value, 'compareSelectors'),
    compatibleSnapshotCommits: readOptionalNullableStringArray(value, 'compatibleSnapshotCommits'),
    compatibleSnapshotRevisions: readOptionalNullableStringArray(
      value,
      'compatibleSnapshotRevisions'
    ),
    compute: readOptionalNullableStringArray(value, 'compute'),
    dataset: readOptionalNullableStringArray(value, 'dataset'),
    dryRun: readBoolean(value, 'dryRun'),
    executionKind: readNullableString(value, 'executionKind'),
    logFile: readNullableString(value, 'logFile'),
    pathContext: parseFdmResolvedPathContext(value.pathContext),
    pid: readNonNegativeIntegerScalar(value, 'pid'),
    planFile: readNullableString(value, 'planFile'),
    planName: readNullableString(value, 'planName'),
    profile: readOptionalNullableStringArray(value, 'profile'),
    remoteDataset: readOptionalNullableStringArray(value, 'remoteDataset'),
    remoteInventoryFile: readNullableString(value, 'remoteInventoryFile'),
    remoteLabel: readNullableString(value, 'remoteLabel'),
    runId: readNullableString(value, 'runId'),
    snapshotLevel: readNullableString(value, 'snapshotLevel'),
    snapshotPolicy: readNullableString(value, 'snapshotPolicy'),
    snapshotReusePolicy: readNullableString(value, 'snapshotReusePolicy'),
    sources: readOptionalNullableStringArray(value, 'sources'),
    sshCompute: readOptionalNullableStringArray(value, 'sshCompute'),
    sshProfile: readNullableString(value, 'sshProfile'),
    stateDir: readNullableString(value, 'stateDir'),
    stateSegment: readNullableString(value, 'stateSegment'),
    timeline: readOptionalNullableStringArray(value, 'timeline'),
    tolerance: readNullableString(value, 'tolerance'),
    toleranceProfile: readNullableString(value, 'toleranceProfile'),
    useSharedBaseline: readBoolean(value, 'useSharedBaseline'),
    workflowId: readNullableString(value, 'workflowId'),
  };
}

function parseFdmCapability(value: unknown): FdmCapability {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    level: readNullableString(value, 'level'),
    name: readNullableString(value, 'name'),
    note: readNullableString(value, 'note'),
    operations: readOptionalNullableStringArray(value, 'operations'),
    supported: readBoolean(value, 'supported'),
  };
}

function parseFdmLifecycleDiagnostic(value: unknown): FdmLifecycleDiagnostic {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    code: readNullableString(value, 'code'),
    message: readNullableString(value, 'message'),
    path: readNullableString(value, 'path'),
    severity: readNullableString(value, 'severity'),
  };
}

function parseFdmWorkflow(value: unknown): FdmWorkflow {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    workflowId: readNullableString(value, 'workflowId'),
    runId: readNullableString(value, 'runId'),
    stateDir: readNullableString(value, 'stateDir'),
    status: readNullableString(value, 'status'),
    sourceFile: readNullableString(value, 'sourceFile'),
    sourceRevision: readNullableString(value, 'sourceRevision'),
  };
}

function parseFdmRunOperation(value: unknown): FdmRunOperation {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    attemptId: readNullableString(value, 'attemptId'),
    disposition: readNullableString(value, 'disposition'),
    evidence: readOptionalNullableStringArray(value, 'evidence'),
    operationId: readNullableString(value, 'operationId'),
    outcome: readNullableString(value, 'outcome'),
    status: readNullableString(value, 'status'),
    updatedAt: readNullableString(value, 'updatedAt'),
  };
}

function parseFdmRun(value: unknown): FdmRun {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    diagnostics: parseNullableArray(value.diagnostics, parseFdmLifecycleDiagnostic),
    operations: parseNullableArray(value.operations, parseFdmRunOperation),
    projectionConsistent: readBoolean(value, 'projectionConsistent'),
    runId: readNullableString(value, 'runId'),
    stateDir: readNullableString(value, 'stateDir'),
    status: readNullableString(value, 'status'),
    workflowId: readNullableString(value, 'workflowId'),
  };
}

function parseFdmJob(value: unknown): FdmJob {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    diagnostics: parseNullableArray(value.diagnostics, parseFdmLifecycleDiagnostic),
    executionKind: readNullableString(value, 'executionKind'),
    jobId: readNullableString(value, 'jobId'),
    operationId: readNullableString(value, 'operationId'),
    runId: readNullableString(value, 'runId'),
    status: readNullableString(value, 'status'),
    taskId: readNullableString(value, 'taskId'),
    workflowId: readNullableString(value, 'workflowId'),
  };
}

function parseFdmRuleset(value: unknown): FdmRuleset {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    operations: readOptionalNullableStringArray(value, 'operations'),
    reference: readNullableString(value, 'reference'),
    roles: readOptionalNullableStringArray(value, 'roles'),
    rulesetId: readNullableString(value, 'rulesetId'),
    version: readNullableNonNegativeIntegerScalar(value, 'version'),
  };
}

function parseFdmBaseline(value: unknown): FdmBaseline {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    baselineId: readNullableString(value, 'baselineId'),
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    computeEngine: readNullableString(value, 'computeEngine'),
    dataset: readNullableString(value, 'dataset'),
    profile: readNullableString(value, 'profile'),
    source: readNullableString(value, 'source'),
    timelinePoint: readNullableString(value, 'timelinePoint'),
  };
}

function parseFdmFork(value: unknown): FdmFork {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    forkId: readNullableString(value, 'forkId'),
    sourceRunId: readNullableString(value, 'sourceRunId'),
    sourceWorkflowId: readNullableString(value, 'sourceWorkflowId'),
    status: readNullableString(value, 'status'),
    targetRunId: readNullableString(value, 'targetRunId'),
    targetWorkflowId: readNullableString(value, 'targetWorkflowId'),
  };
}

function parseFdmLineage(value: unknown): FdmLineage {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: readOptionalNullableStringArray(value, 'capabilities'),
    lineageId: readNullableString(value, 'lineageId'),
    operationId: readNullableString(value, 'operationId'),
    runId: readNullableString(value, 'runId'),
    sourceOperationId: readNullableString(value, 'sourceOperationId'),
    sourceRunId: readNullableString(value, 'sourceRunId'),
    workflowId: readNullableString(value, 'workflowId'),
  };
}

function parseFdmCapabilitiesPayload(value: unknown): FdmCapabilitiesPayload {
  assertRecord(value, 'IDE-GSM GraphQL response malformed');
  return {
    capabilities: parseNullableArray(value.capabilities, parseFdmCapability),
    workflows: parseNullableArray(value.workflows, parseFdmWorkflow),
    runs: parseNullableArray(value.runs, parseFdmRun),
    jobs: parseNullableArray(value.jobs, parseFdmJob),
    rulesets: parseNullableArray(value.rulesets, parseFdmRuleset),
    baselines: parseNullableArray(value.baselines, parseFdmBaseline),
    forks: parseNullableArray(value.forks, parseFdmFork),
    lineage: parseNullableArray(value.lineage, parseFdmLineage),
  };
}

function parseNullableFdmWorkflow(value: unknown): FdmWorkflow | null {
  if (value === undefined || value === null) return null;
  return parseFdmWorkflow(value);
}

function parseNullableFdmRun(value: unknown): FdmRun | null {
  if (value === undefined || value === null) return null;
  return parseFdmRun(value);
}

function parseNullableFdmJob(value: unknown): FdmJob | null {
  if (value === undefined || value === null) return null;
  return parseFdmJob(value);
}

function parseBooleanReport(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error('IDE-GSM GraphQL response malformed');
  }
  return value;
}

function assertNeverCommand(command: never): never {
  void command;
  throw new Error('Unsupported IDE-GSM command');
}

/**
 * Derive the WebSocket URL from an HTTP endpoint URL.
 * The endpoint value is intentionally excluded from validation errors.
 */
export function deriveWsUrl(endpointUrl: string): string {
  const withoutTrailingSlash = endpointUrl.replace(/\/+$/, '');
  if (withoutTrailingSlash.startsWith('https://')) {
    return `wss://${withoutTrailingSlash.slice('https://'.length)}/graphql`;
  }
  if (withoutTrailingSlash.startsWith('http://')) {
    return `ws://${withoutTrailingSlash.slice('http://'.length)}/graphql`;
  }
  throw new Error('Unsupported endpoint URL scheme; expected http or https');
}

/** Failure for a validated terminal task event that did not succeed. */
export class IdeGsmTaskError extends Error {
  readonly status: TaskStatus;

  constructor(status: TaskStatus) {
    super(`IDE-GSM task ended with status ${status}`);
    this.name = 'IdeGsmTaskError';
    this.status = status;
  }
}

/** Typed client for the pinned IDE-GSM GraphQL frontend surface. */
export class IdeGsmClient {
  private readonly endpointUrl: string;
  private readonly authToken: string;
  private readonly graphqlUrl: string;
  private readonly wsClientFactory: WsClientFactory;

  constructor(endpointUrl: string, authToken: string, wsClientFactory?: WsClientFactory) {
    this.endpointUrl = endpointUrl;
    this.authToken = authToken;
    const base = endpointUrl.replace(/\/+$/, '');
    this.graphqlUrl = `${base}/graphql`;
    this.wsClientFactory =
      wsClientFactory ?? ((url, params) => createClient({ url, connectionParams: params }));
  }

  private createHttpClient(): GraphQLClient {
    return new GraphQLClient(this.graphqlUrl, {
      headers: buildAuthHeaders(this.authToken),
    });
  }

  private async requestTask(
    mutationName: TaskMutationName,
    variables?: Record<string, unknown>
  ): Promise<string> {
    try {
      const data = await this.createHttpClient().request<Record<string, unknown>>(
        ideGsmGraphqlDocuments[mutationName],
        variables
      );
      const taskId = data[mutationName];
      if (typeof taskId !== 'string' || taskId.length === 0) {
        throw new Error('invalid task ID');
      }
      return taskId;
    } catch {
      throw new Error('IDE-GSM GraphQL request failed');
    }
  }

  private async requestReport<T>(
    documentName: ReportDocumentName,
    variables: Record<string, unknown> | undefined,
    parse: (value: unknown) => T
  ): Promise<T> {
    try {
      const data = await this.createHttpClient().request<Record<string, unknown>>(
        ideGsmGraphqlDocuments[documentName],
        variables
      );
      return parse(data[documentName]);
    } catch (error) {
      if (error instanceof Error && error.message === 'IDE-GSM GraphQL response malformed') {
        throw error;
      }
      throw new Error('IDE-GSM GraphQL request failed');
    }
  }

  async fdmSpaces(): Promise<IdeGsmFdmSpacesReport> {
    return this.requestReport('fdmSpaces', undefined, parseFdmSpacesReport);
  }

  async fdmDirectoryTree(input?: IdeGsmFdmDirectoryTreeInput): Promise<IdeGsmDirectoryTreeReport> {
    return this.requestReport(
      'fdmDirectoryTree',
      fdmDirectoryVariables(input),
      parseDirectoryTreeReport
    );
  }

  async fdmDirectoryInfo(input?: IdeGsmFdmDirectoryInfoInput): Promise<IdeGsmDirectoryInfoReport> {
    return this.requestReport(
      'fdmDirectoryInfo',
      fdmDirectoryVariables(input),
      parseDirectoryInfoReport
    );
  }

  async fdmDirectoryRemove(
    input: IdeGsmFdmDirectoryRemoveInput
  ): Promise<IdeGsmFdmDirectoryRemoveReport> {
    return this.requestReport(
      'fdmDirectoryRemove',
      fdmDirectoryRemoveVariables(input),
      parseFdmDirectoryRemoveReport
    );
  }

  async fdmSpaceCreate(input: IdeGsmFdmSpaceCreateInput): Promise<IdeGsmFdmSpace> {
    return this.requestReport('fdmSpaceCreate', fdmSpaceCreateVariables(input), parseFdmSpace);
  }

  async fdmSpaceUpdate(input: IdeGsmFdmSpaceUpdateInput): Promise<IdeGsmFdmSpace> {
    return this.requestReport('fdmSpaceUpdate', fdmSpaceUpdateVariables(input), parseFdmSpace);
  }

  async fdmSpaceDelete(input: IdeGsmFdmSpaceDeleteInput): Promise<IdeGsmFdmSpaceDeleteReport> {
    return this.requestReport(
      'fdmSpaceDelete',
      fdmSpaceDeleteVariables(input),
      parseFdmSpaceDeleteReport
    );
  }

  async fdmDashboardStatus(input: FdmDashboardStatusInput): Promise<FdmDashboardStatusPayload> {
    return this.requestReport(
      'fdmDashboardStatus',
      fdmDashboardStatusVariables(input),
      parseFdmDashboardStatusPayload
    );
  }

  async fdmCellDetail(input: FdmCellDetailInput): Promise<FdmCellDetailPayload> {
    return this.requestReport('fdmCellDetail', fdmCellVariables(input), parseFdmCellDetailPayload);
  }

  async fdmRuntimeDiagnostics(
    input: FdmRuntimeDiagnosticsInput
  ): Promise<FdmRuntimeDiagnosticsPayload> {
    return this.requestReport(
      'fdmRuntimeDiagnostics',
      fdmRuntimeDiagnosticsVariables(input),
      parseFdmRuntimeDiagnosticsPayload
    );
  }

  async fdmCapabilities(): Promise<FdmCapabilitiesPayload> {
    return this.requestReport('fdmCapabilities', undefined, parseFdmCapabilitiesPayload);
  }

  async fdmWorkflow(input: FdmLifecycleInput): Promise<FdmWorkflow | null> {
    return this.requestReport(
      'fdmWorkflow',
      fdmLifecycleVariables(input),
      parseNullableFdmWorkflow
    );
  }

  async fdmWorkflows(input: Pick<FdmLifecycleInput, 'spaceId'> = {}): Promise<FdmWorkflow[]> {
    return this.requestReport(
      'fdmWorkflows',
      fdmLifecycleVariables(input),
      (value): FdmWorkflow[] => parseNullableArray(value, parseFdmWorkflow) ?? []
    );
  }

  async fdmRun(input: FdmLifecycleInput): Promise<FdmRun | null> {
    return this.requestReport('fdmRun', fdmLifecycleVariables(input), parseNullableFdmRun);
  }

  async fdmRuns(input: Pick<FdmLifecycleInput, 'spaceId'> = {}): Promise<FdmRun[]> {
    return this.requestReport(
      'fdmRuns',
      fdmLifecycleVariables(input),
      (value): FdmRun[] => parseNullableArray(value, parseFdmRun) ?? []
    );
  }

  async fdmJob(input: FdmLifecycleInput): Promise<FdmJob | null> {
    return this.requestReport('fdmJob', fdmLifecycleVariables(input), parseNullableFdmJob);
  }

  async fdmJobs(input: Pick<FdmLifecycleInput, 'spaceId'> = {}): Promise<FdmJob[]> {
    return this.requestReport(
      'fdmJobs',
      fdmLifecycleVariables(input),
      (value): FdmJob[] => parseNullableArray(value, parseFdmJob) ?? []
    );
  }

  async projectDirectoryTree(
    input: IdeGsmProjectDirectoryInput
  ): Promise<IdeGsmProjectDirectoryTreeReport> {
    return this.requestReport(
      'projectDirectoryTree',
      projectDirectoryVariables(input),
      parseProjectDirectoryTreeReport
    );
  }

  async projectDirectoryInfo(
    input: IdeGsmProjectDirectoryInput
  ): Promise<IdeGsmProjectDirectoryInfoReport> {
    return this.requestReport(
      'projectDirectoryInfo',
      projectDirectoryVariables(input),
      parseProjectDirectoryInfoReport
    );
  }

  async projectYamlFileContent(
    input: ProjectYamlFileContentInput
  ): Promise<ProjectYamlFileContent> {
    return this.requestReport(
      'projectYamlFileContent',
      projectYamlFileVariables(input),
      parseProjectYamlFileContent
    );
  }

  async conditionalProjectYamlWrite(
    input: ConditionalProjectYamlWriteInput
  ): Promise<ConditionalProjectYamlWriteResult> {
    return this.requestReport(
      'conditionalProjectYamlWrite',
      conditionalProjectYamlWriteVariables(input),
      parseConditionalProjectYamlWriteResult
    );
  }

  async beginProjectFileContentTransfer(
    input: ProjectFileContentTransferInput
  ): Promise<ProjectFileContentTransfer> {
    return this.requestReport(
      'beginProjectFileContentTransfer',
      projectCsvFileVariables(input),
      parseProjectFileContentTransfer
    );
  }

  async projectFileContentPage(
    input: ProjectFileContentPageInput
  ): Promise<ProjectFileContentPage> {
    return this.requestReport(
      'projectFileContentPage',
      projectFileContentPageVariables(input),
      parseProjectFileContentPage
    );
  }

  async closeProjectFileContentTransfer(transferId: string): Promise<boolean> {
    assertNonEmpty(transferId, 'transferId');
    return this.requestReport(
      'closeProjectFileContentTransfer',
      { transferId },
      (value): boolean => {
        if (typeof value !== 'boolean') {
          throw new Error('IDE-GSM GraphQL response malformed');
        }
        return value;
      }
    );
  }

  async activeProjectTasks(projectRelativePath: string): Promise<ActiveProjectTask[]> {
    return this.requestReport(
      'activeProjectTasks',
      projectVariables(projectRelativePath),
      parseActiveProjectTasks
    );
  }

  async cancelTask(taskId: string): Promise<TaskCancelResult> {
    assertNonEmpty(taskId, 'taskId');
    return this.requestReport('cancelTask', { taskId }, parseTaskCancelResult);
  }

  async fdmVerify(input: FdmVerifyInput): Promise<FdmVerifyReport> {
    return this.requestReport('fdmVerify', fdmVerifyVariables(input), parseFdmVerifyReport);
  }

  async fdmSweep(input: FdmVerifyInput): Promise<FdmVerifyReport> {
    return this.requestReport('fdmSweep', fdmVerifyVariables(input), parseFdmVerifyReport);
  }

  async fdmRunCancel(input: FdmLifecycleInput): Promise<boolean> {
    return this.requestReport(
      'fdmRunCancel',
      fdmLifecycleCancelVariables(input),
      parseBooleanReport
    );
  }

  async fdmJobCancel(input: FdmLifecycleInput): Promise<boolean> {
    return this.requestReport(
      'fdmJobCancel',
      fdmLifecycleCancelVariables(input),
      parseBooleanReport
    );
  }

  async importProject(projectSnapshot: string, projectRelativePath: string): Promise<string> {
    assertNonEmpty(projectSnapshot, 'projectSnapshot');
    return this.requestTask('importProject', {
      ...projectVariables(projectRelativePath),
      projectSnapshot,
    });
  }

  async exportProject(projectRelativePath: string, filter?: ExportFilter): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'include', filter?.include);
    addDefined(variables, 'exclude', filter?.exclude);
    return this.requestTask('exportProject', variables);
  }

  async init(projectRelativePath: string, githubToken: string, url: string): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    assertNonEmpty(githubToken, 'githubToken');
    assertNonEmpty(url, 'url');
    variables.token = githubToken;
    variables.url = url;
    return this.requestTask('init', variables);
  }

  async install(
    projectRelativePath: string,
    options?: Omit<InstallCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'force', options?.force);
    return this.requestTask('install', variables);
  }

  async checkAll(projectRelativePath: string): Promise<string> {
    return this.requestTask('checkAll', projectVariables(projectRelativePath));
  }

  async checkMerge(projectRelativePath: string): Promise<string> {
    return this.requestTask('checkMerge', projectVariables(projectRelativePath));
  }

  async previewEvents(
    projectRelativePath: string,
    options?: Omit<PreviewEventsCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    const variables = projectVariables(projectRelativePath);
    addDefined(variables, 'profile', options?.profile);
    addDefined(variables, 'yearFilter', options?.yearFilter);
    return this.requestTask('previewEvents', variables);
  }

  async calibrate(
    projectRelativePath: string,
    options?: Omit<CalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrate', calibrateVariables(projectRelativePath, options));
  }

  async simulate(
    projectRelativePath: string,
    options?: Omit<SimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulate', simulateVariables(projectRelativePath, options));
  }

  async purgeCache(projectRelativePath: string): Promise<string> {
    return this.requestTask('purgeCache', projectVariables(projectRelativePath));
  }

  async calibrateRemote(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask(
      'calibrateRemote',
      remoteCalibrateVariables(projectRelativePath, options)
    );
  }

  async simulateRemote(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask(
      'simulateRemote',
      remoteSimulateVariables(projectRelativePath, options)
    );
  }

  async startContainerRemote(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('startContainerRemote');
  }

  async stopContainerRemote(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('stopContainerRemote');
  }

  async calibrateSsh(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrateSsh', remoteCalibrateVariables(projectRelativePath, options));
  }

  async simulateSsh(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulateSsh', remoteSimulateVariables(projectRelativePath, options));
  }

  async calibrateEc2(
    projectRelativePath: string,
    options?: Omit<RemoteCalibrateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('calibrateEc2', remoteCalibrateVariables(projectRelativePath, options));
  }

  async simulateEc2(
    projectRelativePath: string,
    options?: Omit<RemoteSimulateCommandInput, 'projectRelativePath'>
  ): Promise<string> {
    return this.requestTask('simulateEc2', remoteSimulateVariables(projectRelativePath, options));
  }

  async startContainerEc2(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('startContainerEc2');
  }

  async stopContainerEc2(projectRelativePath: string): Promise<string> {
    assertProjectRelativePath(projectRelativePath);
    return this.requestTask('stopContainerEc2');
  }

  async rsyncPush(
    projectRelativePath: string,
    connectionType: RsyncConnectionType,
    filter?: RsyncFilter
  ): Promise<string> {
    return this.requestTask(
      'rsyncPush',
      this.rsyncVariables(projectRelativePath, connectionType, filter)
    );
  }

  async rsyncPull(
    projectRelativePath: string,
    connectionType: RsyncConnectionType,
    filter?: RsyncFilter
  ): Promise<string> {
    return this.requestTask(
      'rsyncPull',
      this.rsyncVariables(projectRelativePath, connectionType, filter)
    );
  }

  private rsyncVariables(
    projectRelativePath: string,
    connectionType: string,
    filter?: RsyncFilter
  ): Record<string, unknown> {
    const variables = projectVariables(projectRelativePath);
    assertConnectionType(connectionType);
    variables.connectionType = connectionType;
    addDefined(variables, 'include', filter?.include);
    addDefined(variables, 'exclude', filter?.exclude);
    return variables;
  }

  /** Dispatch a canonical YAML Step 4 command without aliases or fallbacks. */
  executeCommand(command: IdeGsmCommand): Promise<string> {
    switch (command.id) {
      case 'install':
        return this.install(command.input.projectRelativePath, command.input);
      case 'check':
        return this.checkAll(command.input.projectRelativePath);
      case 'check-merge':
        return this.checkMerge(command.input.projectRelativePath);
      case 'preview-events':
        return this.previewEvents(command.input.projectRelativePath, command.input);
      case 'calib':
        return this.calibrate(command.input.projectRelativePath, command.input);
      case 'sim':
        return this.simulate(command.input.projectRelativePath, command.input);
      case 'purge-cache':
        return this.purgeCache(command.input.projectRelativePath);
      case 'calib-remote':
        return this.calibrateRemote(command.input.projectRelativePath, command.input);
      case 'sim-remote':
        return this.simulateRemote(command.input.projectRelativePath, command.input);
      case 'start-container-remote':
        return this.startContainerRemote(command.input.projectRelativePath);
      case 'stop-container-remote':
        return this.stopContainerRemote(command.input.projectRelativePath);
      case 'calib-ssh':
        return this.calibrateSsh(command.input.projectRelativePath, command.input);
      case 'sim-ssh':
        return this.simulateSsh(command.input.projectRelativePath, command.input);
      case 'calib-ec2':
        return this.calibrateEc2(command.input.projectRelativePath, command.input);
      case 'sim-ec2':
        return this.simulateEc2(command.input.projectRelativePath, command.input);
      case 'start-container-ec2':
        return this.startContainerEc2(command.input.projectRelativePath);
      case 'stop-container-ec2':
        return this.stopContainerEc2(command.input.projectRelativePath);
      case 'rsync-push':
        return this.rsyncPush(
          command.input.projectRelativePath,
          command.input.connectionType,
          command.input
        );
      case 'rsync-pull':
        return this.rsyncPull(
          command.input.projectRelativePath,
          command.input.connectionType,
          command.input
        );
      case 'init':
        return this.init(
          command.input.projectRelativePath,
          command.input.githubToken,
          command.input.url
        );
      default:
        return assertNeverCommand(command);
    }
  }

  /** Wait until a task emits a validated terminal status. */
  awaitTask(taskId: string, onStatus?: TaskStatusListener): Promise<TaskResult> {
    assertNonEmpty(taskId, 'taskId');

    return new Promise<TaskResult>((resolve, reject) => {
      let wsClient: WsClient | undefined;
      let unsubscribe: (() => void) | undefined;
      let cleanupPending = false;
      let unsubscribeCalled = false;
      let disposed = false;
      let settled = false;

      const cleanup = (): void => {
        if (!unsubscribeCalled) {
          if (unsubscribe === undefined) {
            cleanupPending = true;
          } else {
            unsubscribeCalled = true;
            try {
              unsubscribe();
            } catch {
              // Cleanup failures must not prevent the task promise from settling.
            }
          }
        }
        if (!disposed && wsClient !== undefined) {
          disposed = true;
          try {
            void Promise.resolve(wsClient.dispose()).catch(() => undefined);
          } catch {
            // Cleanup failures must not prevent the task promise from settling.
          }
        }
      };

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      try {
        const wsUrl = deriveWsUrl(this.endpointUrl);
        wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));
        unsubscribe = wsClient.subscribe<SubscribeTaskEvent>(
          {
            query: ideGsmGraphqlDocuments.subscribeTask,
            variables: { taskId },
          },
          {
            next: (event) => {
              if (settled) return;

              let result: TaskResult;
              try {
                result = parseTaskResult(event.data?.subscribeTaskOnFrontend);
              } catch {
                fail(new Error('IDE-GSM task subscription returned a malformed event'));
                return;
              }

              if (result.id !== taskId) {
                fail(new Error('IDE-GSM task subscription returned a mismatched task ID'));
                return;
              }

              try {
                onStatus?.(result);
              } catch {
                fail(new Error('IDE-GSM task status listener failed'));
                return;
              }

              if (ACTIVE_TASK_STATUSES.has(result.status)) return;

              settled = true;
              cleanup();
              if (result.status === 'FINISHED') {
                resolve(result);
                return;
              }
              reject(new IdeGsmTaskError(result.status));
            },
            error: () => {
              fail(new Error('IDE-GSM task subscription failed'));
            },
            complete: () => {
              fail(new Error('IDE-GSM task subscription ended before a terminal status'));
            },
          }
        );

        if (cleanupPending && !unsubscribeCalled) {
          unsubscribeCalled = true;
          try {
            unsubscribe();
          } catch {
            // Cleanup failures must not replace the terminal task result.
          }
        }
      } catch {
        if (wsClient !== undefined) {
          fail(new Error('IDE-GSM task subscription failed'));
        } else {
          reject(new Error('IDE-GSM task subscription failed'));
        }
      }
    });
  }

  subscribeTaskLog(taskId: string, onLog: TaskLogListener): () => void {
    assertNonEmpty(taskId, 'taskId');

    const wsUrl = deriveWsUrl(this.endpointUrl);
    const wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));
    let disposed = false;
    const disposeClient = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        void Promise.resolve(wsClient.dispose()).catch(() => undefined);
      } catch {
        // Cleanup failures must not outlive unsubscribe.
      }
    };
    const unsubscribe = wsClient.subscribe<SubscribeTaskLogEvent>(
      {
        query: ideGsmGraphqlDocuments.subscribeTaskLog,
        variables: { taskId },
      },
      {
        next: (event) => {
          const result = parseTaskLogEvent(event.data?.subscribeTaskLog);
          if (result.taskId !== taskId) {
            throw new Error('IDE-GSM task log subscription returned a mismatched task ID');
          }
          onLog(result);
        },
        error: () => {
          disposeClient();
        },
        complete: () => {
          disposeClient();
        },
      }
    );

    return () => {
      try {
        unsubscribe();
      } finally {
        disposeClient();
      }
    };
  }

  subscribeFdmCellLog(input: FdmCellLogInput, onLog: FdmCellLogListener): () => void {
    const variables = fdmCellVariables(input);
    const wsUrl = deriveWsUrl(this.endpointUrl);
    const wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));
    let disposed = false;
    const disposeClient = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        void Promise.resolve(wsClient.dispose()).catch(() => undefined);
      } catch {
        // Cleanup failures must not outlive unsubscribe.
      }
    };
    const unsubscribe = wsClient.subscribe<SubscribeFdmCellLogEvent>(
      {
        query: ideGsmGraphqlDocuments.subscribeFdmCellLog,
        variables,
      },
      {
        next: (event) => {
          onLog(parseFdmCellLogStreamPayload(event.data?.subscribeFdmCellLog));
        },
        error: () => {
          disposeClient();
        },
        complete: () => {
          disposeClient();
        },
      }
    );

    return () => {
      try {
        unsubscribe();
      } finally {
        disposeClient();
      }
    };
  }

  subscribeFdmRuntimeEvents(
    input: FdmRuntimeEventsInput,
    onEvent: FdmRuntimeEventListener
  ): () => void {
    const variables = fdmRuntimeEventsVariables(input);
    const wsUrl = deriveWsUrl(this.endpointUrl);
    const wsClient = this.wsClientFactory(wsUrl, buildAuthHeaders(this.authToken));
    let disposed = false;
    const disposeClient = (): void => {
      if (disposed) return;
      disposed = true;
      try {
        void Promise.resolve(wsClient.dispose()).catch(() => undefined);
      } catch {
        // Cleanup failures must not outlive unsubscribe.
      }
    };
    const unsubscribe = wsClient.subscribe<SubscribeFdmRuntimeEventsEvent>(
      {
        query: ideGsmGraphqlDocuments.subscribeFdmRuntimeEvents,
        variables,
      },
      {
        next: (event) => {
          onEvent(parseFdmRuntimeEventPayload(event.data?.subscribeFdmRuntimeEvents));
        },
        error: () => {
          disposeClient();
        },
        complete: () => {
          disposeClient();
        },
      }
    );

    return () => {
      try {
        unsubscribe();
      } finally {
        disposeClient();
      }
    };
  }
}
