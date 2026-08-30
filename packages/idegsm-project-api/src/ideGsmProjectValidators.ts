import type { NodeId } from '@hierarchidb/core-types';
import {
  IDEGSM_PROJECT_ENTITY_VERSION,
  type IdeGsmProjectChildMetadata,
  IdeGsmProjectContractError,
  type IdeGsmProjectDirectoryRequest,
  type IdeGsmProjectIdentity,
  type IdeGsmProjectRootNodeData,
  type IdeGsmProjectSnapshot,
  type IdeGsmProjectSnapshotEntry,
  type IdeGsmProjectSnapshotManifest,
  type IdeGsmProjectSyncState,
  type IdeGsmProjectTabularContent,
} from './ideGsmProjectTypes.js';

const FORBIDDEN_ROOT_KEYS = [
  'mountKind',
  'mountId',
  'sourceKind',
  'projectId',
  'endpoint',
  'endpointUrl',
  'graphqlUrl',
  'token',
  'jwt',
  'authToken',
  'credential',
  'credentials',
  'absolutePath',
  'rawBody',
  'body',
  'content',
] as const;

const SYNC_STATES = new Set<IdeGsmProjectSyncState>([
  'not-synced',
  'syncing',
  'synced',
  'stale',
  'failed',
]);

export function assertIdeGsmProjectRootNodeData(
  value: unknown
): asserts value is IdeGsmProjectRootNodeData {
  const record = assertRecord(value, 'IDE-GSM project root data');
  rejectForbiddenKeys(record, FORBIDDEN_ROOT_KEYS, 'IDE-GSM project root data');
  if (record.version !== IDEGSM_PROJECT_ENTITY_VERSION) {
    throw new IdeGsmProjectContractError('IDE-GSM project root data version must be 1');
  }
  assertNonEmptyString(record.connectionName, 'connectionName');
  assertProjectRelativePath(record.projectRelativePath, 'projectRelativePath');
  assertStringOrNull(record.activeSyncGenerationId, 'activeSyncGenerationId');
  if (!SYNC_STATES.has(record.syncState as IdeGsmProjectSyncState)) {
    throw new IdeGsmProjectContractError('syncState is invalid');
  }
  assertStringOrNull(record.syncedAt, 'syncedAt');
}

export function assertIdeGsmProjectChildMetadata(
  value: unknown
): asserts value is IdeGsmProjectChildMetadata {
  const record = assertRecord(value, 'IDE-GSM project child metadata');
  rejectForbiddenKeys(record, FORBIDDEN_ROOT_KEYS, 'IDE-GSM project child metadata');
  assertNonEmptyString(record.projectNodeId, 'projectNodeId');
  assertNonEmptyString(record.generationId, 'generationId');
  assertProjectRelativePath(record.relativePath, 'relativePath', true);
  if (record.kind !== 'folder' && record.kind !== 'yaml-file' && record.kind !== 'csv-file') {
    throw new IdeGsmProjectContractError('kind is invalid');
  }
  assertStringOrNull(record.digest, 'digest');
  if (
    record.sizeBytes !== null &&
    (typeof record.sizeBytes !== 'number' ||
      !Number.isFinite(record.sizeBytes) ||
      record.sizeBytes < 0)
  ) {
    throw new IdeGsmProjectContractError('sizeBytes must be a finite non-negative number or null');
  }
  assertStringOrNull(record.updatedAt, 'updatedAt');
  if (record.kind === 'csv-file') {
    assertTabularContent(record.tabularContent, 'tabularContent');
  } else if (record.tabularContent !== undefined) {
    throw new IdeGsmProjectContractError('tabularContent is only allowed for csv-file entries');
  }
}

export function createIdeGsmProjectRootNodeData(
  identity: IdeGsmProjectIdentity
): IdeGsmProjectRootNodeData {
  assertNonEmptyString(identity.connectionName, 'connectionName');
  assertProjectRelativePath(identity.projectRelativePath, 'projectRelativePath');
  return {
    version: IDEGSM_PROJECT_ENTITY_VERSION,
    connectionName: identity.connectionName,
    projectRelativePath: identity.projectRelativePath,
    activeSyncGenerationId: null,
    syncState: 'not-synced',
    syncedAt: null,
  };
}

export function sameIdeGsmProjectIdentity(
  left: IdeGsmProjectIdentity,
  right: IdeGsmProjectIdentity
): boolean {
  return (
    left.connectionName === right.connectionName &&
    left.projectRelativePath === right.projectRelativePath
  );
}

export function createIdeGsmProjectDirectoryRequest(
  identity: IdeGsmProjectIdentity,
  path?: string,
  depth?: number
): IdeGsmProjectDirectoryRequest {
  assertNonEmptyString(identity.connectionName, 'connectionName');
  assertProjectRelativePath(identity.projectRelativePath, 'projectRelativePath');
  if (path !== undefined) {
    assertProjectRelativePath(path, 'path', true);
  }
  if (depth !== undefined && (!Number.isInteger(depth) || depth < 0)) {
    throw new IdeGsmProjectContractError('depth must be a non-negative integer');
  }
  return {
    connectionName: identity.connectionName,
    projectRelativePath: identity.projectRelativePath,
    ...(path === undefined ? {} : { path }),
    ...(depth === undefined ? {} : { depth }),
  };
}

export function createIdeGsmProjectChildMetadata(input: {
  projectNodeId: NodeId;
  generationId: string;
  relativePath: string;
  kind: IdeGsmProjectChildMetadata['kind'];
  digest?: string | null;
  sizeBytes?: number | null;
  updatedAt?: string | null;
}): IdeGsmProjectChildMetadata {
  const metadata = {
    projectNodeId: input.projectNodeId,
    generationId: input.generationId,
    relativePath: input.relativePath,
    kind: input.kind,
    digest: input.digest ?? null,
    sizeBytes: input.sizeBytes ?? null,
    updatedAt: input.updatedAt ?? null,
    ...(input.kind === 'csv-file' ? { tabularContent: { policy: 'metadata-only' } } : {}),
  };
  assertIdeGsmProjectChildMetadata(metadata);
  return metadata;
}

export function createTrackedIdeGsmProjectChildMetadata(
  metadata: IdeGsmProjectChildMetadata,
  input: {
    readonly snapshotId: string;
    readonly contentGenerationId: string;
    readonly digest: string;
    readonly sizeBytes: number;
    readonly updatedAt: string;
  }
): IdeGsmProjectChildMetadata {
  assertIdeGsmProjectChildMetadata(metadata);
  if (metadata.kind !== 'csv-file') {
    throw new IdeGsmProjectContractError('tracked tabular content requires a csv-file entry');
  }
  assertNonEmptyString(input.snapshotId, 'snapshotId');
  assertNonEmptyString(input.contentGenerationId, 'contentGenerationId');
  assertNonEmptyString(input.digest, 'digest');
  assertNonNegativeFiniteNumber(input.sizeBytes, 'sizeBytes');
  assertNonEmptyString(input.updatedAt, 'updatedAt');
  const next = {
    ...metadata,
    digest: input.digest,
    sizeBytes: input.sizeBytes,
    updatedAt: input.updatedAt,
    tabularContent: {
      policy: 'tracked',
      snapshotId: input.snapshotId,
      contentGenerationId: input.contentGenerationId,
    },
  };
  assertIdeGsmProjectChildMetadata(next);
  return next;
}

export function createIdeGsmProjectSnapshotManifest(
  snapshot: IdeGsmProjectSnapshot
): IdeGsmProjectSnapshotManifest {
  assertNonEmptyString(snapshot.connectionName, 'connectionName');
  assertProjectRelativePath(snapshot.projectRelativePath, 'projectRelativePath');
  if (!Array.isArray(snapshot.entries)) {
    throw new IdeGsmProjectContractError('entries must be an array');
  }
  let folderCount = 0;
  let yamlCount = 0;
  let csvCount = 0;
  for (const entry of snapshot.entries) {
    assertIdeGsmProjectSnapshotEntry(entry);
    if (entry.kind === 'folder') folderCount += 1;
    if (entry.kind === 'yaml-file') yamlCount += 1;
    if (entry.kind === 'csv-file') csvCount += 1;
  }
  return {
    connectionName: snapshot.connectionName,
    projectRelativePath: snapshot.projectRelativePath,
    entryCount: snapshot.entries.length,
    yamlCount,
    csvCount,
    folderCount,
  };
}

export function assertIdeGsmProjectSnapshotEntry(
  value: unknown
): asserts value is IdeGsmProjectSnapshotEntry {
  const record = assertRecord(value, 'IDE-GSM project snapshot entry');
  rejectForbiddenKeys(record, FORBIDDEN_ROOT_KEYS, 'IDE-GSM project snapshot entry');
  assertProjectRelativePath(record.relativePath, 'relativePath');
  if (record.kind !== 'folder' && record.kind !== 'yaml-file' && record.kind !== 'csv-file') {
    throw new IdeGsmProjectContractError('kind is invalid');
  }
  assertStringOrNull(record.digest ?? null, 'digest');
  assertStringOrNull(record.updatedAt ?? null, 'updatedAt');
  if (
    record.sizeBytes !== undefined &&
    record.sizeBytes !== null &&
    (typeof record.sizeBytes !== 'number' ||
      !Number.isFinite(record.sizeBytes) ||
      record.sizeBytes < 0)
  ) {
    throw new IdeGsmProjectContractError('sizeBytes must be a finite non-negative number or null');
  }
  if (record.kind === 'yaml-file' && typeof record.yamlContent !== 'string') {
    throw new IdeGsmProjectContractError('yamlContent must be present for yaml-file entries');
  }
  if (record.kind !== 'yaml-file' && record.yamlContent !== undefined) {
    throw new IdeGsmProjectContractError('yamlContent is only allowed for yaml-file entries');
  }
}

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new IdeGsmProjectContractError(`${label} must be an object`);
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
      throw new IdeGsmProjectContractError(`${label} must not contain ${key}`);
    }
  }
}

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new IdeGsmProjectContractError(`${fieldName} must be a trimmed non-empty string`);
  }
}

function assertStringOrNull(value: unknown, fieldName: string): asserts value is string | null {
  if (value !== null && typeof value !== 'string') {
    throw new IdeGsmProjectContractError(`${fieldName} must be a string or null`);
  }
}

function assertTabularContent(
  value: unknown,
  fieldName: string
): asserts value is IdeGsmProjectTabularContent {
  const record = assertRecord(value, fieldName);
  if (record.policy === 'metadata-only') {
    if (Object.keys(record).length !== 1) {
      throw new IdeGsmProjectContractError(
        'metadata-only tabularContent must not contain snapshot fields'
      );
    }
    return;
  }
  if (record.policy === 'tracked') {
    assertNonEmptyString(record.snapshotId, 'tabularContent.snapshotId');
    assertNonEmptyString(record.contentGenerationId, 'tabularContent.contentGenerationId');
    return;
  }
  throw new IdeGsmProjectContractError('tabularContent.policy is invalid');
}

function assertNonNegativeFiniteNumber(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new IdeGsmProjectContractError(`${fieldName} must be a finite non-negative number`);
  }
}

export function assertProjectRelativePath(
  value: unknown,
  fieldName: string,
  allowEmpty = false
): asserts value is string {
  if (typeof value !== 'string') {
    throw new IdeGsmProjectContractError(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/u.test(trimmed);
  const segments = trimmed.split(/[\\/]/u);
  if (
    trimmed !== value ||
    (!allowEmpty && trimmed.length === 0) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    isWindowsAbsolute ||
    segments.includes('..')
  ) {
    throw new IdeGsmProjectContractError(
      `${fieldName} must be a relative logical path without parent traversal`
    );
  }
}
