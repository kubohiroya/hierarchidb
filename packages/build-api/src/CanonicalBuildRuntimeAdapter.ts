import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  CanonicalBuildRuntimeError,
  type CanonicalBuildRuntimeErrorCode,
} from './CanonicalBuildRuntimeError.js';
import type {
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
} from './isBuildControlAPIV2Enabled.js';

export type CanonicalBuildRuntimeUnsubscribe = () => void;

export interface CanonicalBuildRuntimeAdapter {
  readonly nodeType: NodeType;
  getSession(nodeId: NodeId): Promise<BuildSessionRuntimeRecord | null>;
  listSessions(filter?: BuildSessionRuntimeFilter): Promise<BuildSessionRuntimeRecord[]>;
  subscribeSessions(
    filter: BuildSessionRuntimeFilter | undefined,
    callback: (sessions: BuildSessionRuntimeRecord[]) => void
  ): CanonicalBuildRuntimeUnsubscribe | Promise<CanonicalBuildRuntimeUnsubscribe>;
  deleteSession(nodeId: NodeId): Promise<void>;
}

export const canonicalBuildRuntimeAdapterMethodNames = [
  'getSession',
  'listSessions',
  'subscribeSessions',
  'deleteSession',
] as const satisfies readonly (keyof CanonicalBuildRuntimeAdapter)[];

export const canonicalBuildSessionRuntimeStatuses = [
  'idle',
  'starting',
  'running',
  'pausing',
  'paused',
  'resuming',
  'finalizing',
  'completed',
  'failed',
  'deleting',
] as const satisfies readonly BuildSessionRuntimeStatus[];

export const isBuildSessionRuntimeStatus = (value: unknown): value is BuildSessionRuntimeStatus =>
  typeof value === 'string' &&
  canonicalBuildSessionRuntimeStatuses.includes(value as BuildSessionRuntimeStatus);

export const activeBuildSessionRuntimeStatuses = [
  'starting',
  'running',
  'pausing',
  'resuming',
  'finalizing',
] as const satisfies readonly BuildSessionRuntimeStatus[];

export const isActiveBuildSessionRuntimeStatus = (status: BuildSessionRuntimeStatus): boolean =>
  activeBuildSessionRuntimeStatuses.includes(
    status as (typeof activeBuildSessionRuntimeStatuses)[number]
  );

export const assertCanonicalBuildRuntimeRecord = (
  record: BuildSessionRuntimeRecord,
  expectedNodeType?: NodeType
): BuildSessionRuntimeRecord => {
  if (!isBuildSessionRuntimeStatus(record.status)) {
    throwRuntimeRecordError('CANONICAL_BUILD_RUNTIME_RECORD_INVALID_STATUS', record, 'status');
  }
  if (!Number.isInteger(record.revision) || record.revision < 0) {
    throwRuntimeRecordError('CANONICAL_BUILD_RUNTIME_RECORD_INVALID_REVISION', record, 'revision');
  }
  const expectedActive = isActiveBuildSessionRuntimeStatus(record.status);
  if (record.isActive !== expectedActive) {
    throwRuntimeRecordError(
      'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_ACTIVE_STATE',
      record,
      'isActive'
    );
  }
  if (expectedNodeType !== undefined && record.nodeType !== expectedNodeType) {
    throwRuntimeRecordError(
      'CANONICAL_BUILD_RUNTIME_RECORD_NODE_TYPE_MISMATCH',
      record,
      'nodeType'
    );
  }
  return record;
};

export const assertCanonicalBuildRuntimeRecords = (
  records: BuildSessionRuntimeRecord[],
  expectedNodeType?: NodeType
): BuildSessionRuntimeRecord[] =>
  records.map((record) => assertCanonicalBuildRuntimeRecord(record, expectedNodeType));

const throwRuntimeRecordError = (
  code: CanonicalBuildRuntimeErrorCode,
  record: BuildSessionRuntimeRecord,
  field: string
): never => {
  throw new CanonicalBuildRuntimeError(
    `Canonical build runtime record ${field} contract violation for ${String(record.nodeType)}:${String(record.nodeId)}`,
    {
      code,
      nodeType: record.nodeType,
      nodeId: record.nodeId,
      field,
    }
  );
};
