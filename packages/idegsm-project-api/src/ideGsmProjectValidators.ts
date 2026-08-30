import type { NodeId } from '@hierarchidb/core-types';
import {
  IDEGSM_PROJECT_ENTITY_VERSION,
  type IdeGsmProjectChildMetadata,
  IdeGsmProjectContractError,
  type IdeGsmProjectDirectoryRequest,
  type IdeGsmProjectIdentity,
  type IdeGsmProjectRootNodeData,
  type IdeGsmProjectSyncState,
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
  };
  assertIdeGsmProjectChildMetadata(metadata);
  return metadata;
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
