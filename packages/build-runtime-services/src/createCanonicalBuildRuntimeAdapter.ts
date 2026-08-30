import type {
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  BuildSessionStatus,
  CanonicalBuildRuntimeAdapter,
} from '@hierarchidb/build-api';
import { CanonicalBuildRuntimeError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { CanonicalBuildRuntimeRevisionTracker } from './CanonicalBuildRuntimeRevisionTracker.js';
import { createBuildSessionRuntimeRecord } from './createBuildSessionRuntimeRecord.js';

export interface CanonicalBuildRuntimeSessionInventory {
  getBuildSessionRuntimeStatus(nodeId: NodeId): Promise<BuildSessionStatus | null>;
  listBuildSessionRuntimeStatuses(): Promise<BuildSessionStatus[]>;
  deleteBuildSessionRuntime(nodeId: NodeId): Promise<void>;
  subscribeBuildSessionRuntimeChanges(listener: () => void): () => void;
}

export interface CreateCanonicalBuildRuntimeAdapterOptions {
  nodeType: NodeType;
  inventory: CanonicalBuildRuntimeSessionInventory;
  revisionTracker?: CanonicalBuildRuntimeRevisionTracker;
}

export const createCanonicalBuildRuntimeAdapter = ({
  nodeType,
  inventory,
  revisionTracker = new CanonicalBuildRuntimeRevisionTracker(),
}: CreateCanonicalBuildRuntimeAdapterOptions): CanonicalBuildRuntimeAdapter => {
  const fingerprints = new Map<string, string>();

  const toRuntimeRecord = (status: BuildSessionStatus): BuildSessionRuntimeRecord => {
    const runtimeStatus = resolveRuntimeStatusFromBuildSessionStatus(status.status);
    const fingerprint = JSON.stringify({
      status: runtimeStatus,
      progress: status.progress,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      updatedAt: status.lastActivity,
      error: status.error,
      inputSource: status.inputSource,
    });
    const key = String(status.nodeId);
    const revision =
      fingerprints.get(key) === fingerprint
        ? revisionTracker.current(nodeType, status.nodeId)
        : revisionTracker.next(nodeType, status.nodeId);
    fingerprints.set(key, fingerprint);
    return createBuildSessionRuntimeRecord({
      nodeType,
      nodeId: status.nodeId,
      status: runtimeStatus,
      progress: status.progress,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      updatedAt: status.lastActivity,
      error: status.error,
      revision,
      inputSource: status.inputSource,
    });
  };

  const listSessions = async (
    filter?: BuildSessionRuntimeFilter
  ): Promise<BuildSessionRuntimeRecord[]> => {
    const statuses = await inventory.listBuildSessionRuntimeStatuses();
    return statuses.map(toRuntimeRecord).filter((record) => matchesRuntimeFilter(record, filter));
  };

  return {
    nodeType,
    getSession: async (nodeId) => {
      const status = await inventory.getBuildSessionRuntimeStatus(nodeId);
      if (!status) return null;
      return toRuntimeRecord(status);
    },
    listSessions,
    subscribeSessions: (filter, callback) => {
      const dispatch = (): void => {
        void listSessions(filter).then(callback);
      };
      dispatch();
      return inventory.subscribeBuildSessionRuntimeChanges(dispatch);
    },
    deleteSession: (nodeId) => inventory.deleteBuildSessionRuntime(nodeId),
  };
};

export const resolveRuntimeStatusFromBuildSessionStatus = (
  status: BuildSessionStatus['status']
): BuildSessionRuntimeStatus => {
  switch (status) {
    case 'queued':
      return 'starting';
    case 'running':
      return 'running';
    case 'pausing':
      return 'pausing';
    case 'paused':
      return 'paused';
    case 'canceling':
      return 'canceling';
    case 'canceled':
      return 'canceled';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'idle':
      return 'idle';
    case 'recycled':
      throw new CanonicalBuildRuntimeError(
        '[build-runtime-services] recycled is not a canonical runtime status',
        {
          code: 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_STATUS',
          field: 'status',
        }
      );
  }
};

const matchesRuntimeFilter = (
  record: BuildSessionRuntimeRecord,
  filter?: BuildSessionRuntimeFilter
): boolean => {
  if (filter?.nodeId !== undefined && record.nodeId !== filter.nodeId) return false;
  if (filter?.statuses && filter.statuses.length > 0 && !filter.statuses.includes(record.status)) {
    return false;
  }
  if (filter?.activeOnly === true && !record.isActive) return false;
  return true;
};
