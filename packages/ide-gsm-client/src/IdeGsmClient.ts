import { GraphQLClient } from 'graphql-request';
import type { Client as WsClient } from 'graphql-ws';
import { createClient } from 'graphql-ws';
import { ideGsmGraphqlDocuments } from './ideGsmGraphqlDocuments.js';
import type {
  ActiveProjectTask,
  ActiveProjectTaskStatus,
  CalibrateCommandInput,
  ConditionalProjectYamlWriteInput,
  ConditionalProjectYamlWriteResult,
  ExportFilter,
  IdeGsmCommand,
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
import type {
  IdeGsmDirectoryInfoReport,
  IdeGsmDirectoryNode,
  IdeGsmDirectoryTreeReport,
  IdeGsmFdmDirectoryInfoInput,
  IdeGsmFdmDirectoryRemoveInput,
  IdeGsmFdmDirectoryRemoveReport,
  IdeGsmFdmDirectoryTreeInput,
  IdeGsmFdmSpacesReport,
  IdeGsmProjectDirectoryInfoReport,
  IdeGsmProjectDirectoryInput,
  IdeGsmProjectDirectoryTreeReport,
} from './mount/IdeGsmMountTypes.js';
import {
  assertLogicalPath,
  assertProjectRelativePath as assertMountProjectRelativePath,
} from './mount/IdeGsmMountTypes.js';

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
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;
const YAML_PATH_PATTERN = /\.ya?ml$/u;
const CSV_PATH_PATTERN = /\.csv$/u;
const CSV_TRANSFER_CHUNK_SIZE_BYTES = 16_384;

type ReportDocumentName =
  | 'fdmSpaces'
  | 'fdmDirectoryTree'
  | 'fdmDirectoryInfo'
  | 'fdmDirectoryRemove'
  | 'projectDirectoryTree'
  | 'projectDirectoryInfo'
  | 'projectYamlFileContent'
  | 'beginProjectFileContentTransfer'
  | 'projectFileContentPage'
  | 'closeProjectFileContentTransfer'
  | 'conditionalProjectYamlWrite'
  | 'activeProjectTasks'
  | 'cancelTask';

type TaskMutationName = Exclude<
  keyof typeof ideGsmGraphqlDocuments,
  ReportDocumentName | 'subscribeTask' | 'subscribeTaskLog'
>;

interface SubscribeTaskEvent {
  subscribeTaskOnFrontend?: unknown;
}

interface SubscribeTaskLogEvent {
  subscribeTaskLog?: unknown;
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
    spaces: value.spaces.map((space) => {
      assertRecord(space, 'IDE-GSM GraphQL response malformed');
      return { spaceId: readString(space, 'spaceId') };
    }),
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
    registeredAt: readString(value, 'registeredAt'),
    startedAt: readOptionalNullableString(value, 'startedAt'),
    updatedAt: readString(value, 'updatedAt'),
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
}
