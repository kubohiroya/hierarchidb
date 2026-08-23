import type {
  BuildProgress,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  CanonicalBuildInputSource,
  CanonicalBuildRuntimeAdapter,
} from '@hierarchidb/build-api';
import { assertCanonicalBuildRuntimeRecords } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  publishBuildSessionUpdate,
  subscribeToBuildSessionBroadcast,
} from '@hierarchidb/runtime-worker';
import type {
  ShapeBuildProgressSummary,
  ShapeBuildSessionRecord,
  ShapeMutationAPI,
  ShapeQueryAPI,
} from '@hierarchidb/shape-api';
import { liveQuery } from 'dexie';
import { PLUGIN_NODE_TYPE } from '../plugin-manifest.js';

type ShapeRuntimeAdapterDeps = {
  queryAPI: ShapeQueryAPI;
  mutationAPI: ShapeMutationAPI;
};

type ShapeRuntimeSessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

const SHAPE_NODE_TYPE = PLUGIN_NODE_TYPE;
const RUNTIME_KEY_SEPARATOR = '\u0000';
const RUNTIME_SESSION_STATUSES: ShapeRuntimeSessionStatus[] = [
  'idle',
  'running',
  'paused',
  'completed',
  'failed',
];
const TASK_STAGES = new Set(['source', 'geometry', 'tileEmit']);

let adapterDeps: ShapeRuntimeAdapterDeps | null = null;

const runtimeStatusOverrides = new Map<string, BuildSessionRuntimeStatus>();
const runtimeRevisions = new Map<string, number>();
const runtimeNodeIndex = new Map<string, { nodeType: NodeType; nodeId: NodeId }>();
const runtimeInputSources = new Map<string, CanonicalBuildInputSource>();

export const configureShapeCanonicalBuildRuntimeAdapter = (deps: ShapeRuntimeAdapterDeps): void => {
  adapterDeps = deps;
};

export const setShapeBuildRuntimeInputSource = (
  nodeId: NodeId,
  inputSource: CanonicalBuildInputSource
): void => {
  runtimeInputSources.set(toRuntimeKey(SHAPE_NODE_TYPE, nodeId), inputSource);
};

export const setShapeBuildRuntimeTransientStatus = (
  nodeId: NodeId,
  status: BuildSessionRuntimeStatus
): void => {
  const key = toRuntimeKey(SHAPE_NODE_TYPE, nodeId);
  runtimeStatusOverrides.set(key, status);
  runtimeNodeIndex.set(key, { nodeType: SHAPE_NODE_TYPE, nodeId });
  bumpRuntimeRevision(SHAPE_NODE_TYPE, nodeId);
  publishBuildSessionUpdate({ nodeId, status });
};

export const clearShapeBuildRuntimeTransientStatus = (nodeId: NodeId): void => {
  const key = toRuntimeKey(SHAPE_NODE_TYPE, nodeId);
  runtimeStatusOverrides.delete(key);
  runtimeNodeIndex.set(key, { nodeType: SHAPE_NODE_TYPE, nodeId });
  bumpRuntimeRevision(SHAPE_NODE_TYPE, nodeId);
  publishBuildSessionUpdate({ nodeId });
};

export const canonicalBuildRuntimeAdapter: CanonicalBuildRuntimeAdapter = {
  nodeType: SHAPE_NODE_TYPE,
  getSession: async (nodeId) => {
    const sessions = await getRuntimeRecordsForShape({ nodeId });
    return sessions[0] ?? null;
  },
  listSessions: getRuntimeRecordsForShape,
  subscribeSessions: async (filter, callback) => {
    const { queryAPI } = requireAdapterDeps();
    const observable = liveQuery(() =>
      queryAPI.listBuildSessionRecordsByStatus(RUNTIME_SESSION_STATUSES)
    );
    const dispatch = async (): Promise<void> => {
      const sessions = await getRuntimeRecordsForShape(filter);
      callback(sessions);
    };
    const subscription = observable.subscribe({
      next: () => {
        void dispatch();
      },
      error: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[shape canonical runtime adapter] subscription failed:', msg);
      },
    });
    const broadcastUnsubscribe = subscribeToBuildSessionBroadcast(() => {
      void dispatch();
    });
    await dispatch();
    return () => {
      subscription.unsubscribe();
      broadcastUnsubscribe();
    };
  },
  deleteSession: async (nodeId) => {
    const { queryAPI, mutationAPI } = requireAdapterDeps();
    const current = await queryAPI.getBuildSessionRecord(nodeId);
    if (current?.status === 'running') {
      throw new Error('Cannot delete a running build session.');
    }
    setShapeBuildRuntimeTransientStatus(nodeId, 'deleting');
    try {
      await mutationAPI.deleteBuildSession(nodeId);
      clearShapeBuildRuntimeTransientStatus(nodeId);
    } catch (error) {
      clearShapeBuildRuntimeTransientStatus(nodeId);
      throw error;
    }
  },
};

const requireAdapterDeps = (): ShapeRuntimeAdapterDeps => {
  if (!adapterDeps) {
    throw new Error('[shape canonical runtime adapter] adapter dependencies are not configured');
  }
  return adapterDeps;
};

const toRuntimeKey = (nodeType: NodeType, nodeId: NodeId): string =>
  `${String(nodeType)}${RUNTIME_KEY_SEPARATOR}${String(nodeId)}`;

const bumpRuntimeRevision = (nodeType: NodeType, nodeId: NodeId): number => {
  const key = toRuntimeKey(nodeType, nodeId);
  const next = (runtimeRevisions.get(key) ?? 0) + 1;
  runtimeRevisions.set(key, next);
  runtimeNodeIndex.set(key, { nodeType, nodeId });
  return next;
};

const resolveRuntimeStatusFromShapeRecord = (
  status: ShapeBuildSessionRecord['status']
): BuildSessionRuntimeStatus => {
  switch (status) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'idle':
      return 'idle';
  }
};

const requireBuildProgressCount = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(
      `[shape canonical runtime adapter] build progress ${field} must be a non-negative integer`
    );
  }
  return value as number;
};

const requireBuildProgressPercentage = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `[shape canonical runtime adapter] build progress percentage must be finite 0..100`
    );
  }
  return value;
};

const isTaskStage = (value: unknown): value is BuildProgress['stage'] =>
  typeof value === 'string' && TASK_STAGES.has(value);

const toBuildProgress = (progress: ShapeBuildProgressSummary): BuildProgress => {
  const total = requireBuildProgressCount(progress.total, 'total');
  const completed = requireBuildProgressCount(progress.completed, 'completed');
  const failed = requireBuildProgressCount(progress.failed, 'failed');
  const skipped = requireBuildProgressCount(progress.skipped, 'skipped');
  const terminal = completed + failed + skipped;
  if (terminal > total) {
    throw new Error(
      `[shape canonical runtime adapter] terminal build task count must not exceed total: terminal=${terminal}, total=${total}`
    );
  }
  const stage = (progress as { stage?: unknown }).stage;
  if (stage !== undefined && !isTaskStage(stage)) {
    throw new Error(
      `[shape canonical runtime adapter] invalid build progress stage: ${String(stage)}`
    );
  }
  return {
    total,
    completed,
    failed,
    skipped,
    percentage: requireBuildProgressPercentage(progress.percentage),
    ...(stage === undefined ? {} : { stage }),
  };
};

const toRuntimeRecord = (session: ShapeBuildSessionRecord): BuildSessionRuntimeRecord => {
  const key = toRuntimeKey(SHAPE_NODE_TYPE, session.nodeId);
  runtimeNodeIndex.set(key, { nodeType: SHAPE_NODE_TYPE, nodeId: session.nodeId });
  const persistedStatus = resolveRuntimeStatusFromShapeRecord(session.status);
  const runtimeStatus = runtimeStatusOverrides.get(key) ?? persistedStatus;
  return {
    nodeType: SHAPE_NODE_TYPE,
    nodeId: session.nodeId,
    status: runtimeStatus,
    isActive: isActiveRuntimeStatus(runtimeStatus),
    progress: toBuildProgress(session.progress),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    inactiveMs: session.inactiveMs,
    lastHeartbeatAt: session.lastHeartbeatAt,
    error: session.status === 'failed' ? 'failed' : undefined,
    revision: runtimeRevisions.get(key) ?? Number(session.updatedAt ?? 0),
    inputSource: runtimeInputSources.get(key),
  };
};

const toSyntheticRuntimeRecord = (nodeId: NodeId): BuildSessionRuntimeRecord | null => {
  const key = toRuntimeKey(SHAPE_NODE_TYPE, nodeId);
  const transient = runtimeStatusOverrides.get(key);
  if (!transient) return null;
  return {
    nodeType: SHAPE_NODE_TYPE,
    nodeId,
    status: transient,
    isActive: isActiveRuntimeStatus(transient),
    revision: runtimeRevisions.get(key) ?? bumpRuntimeRevision(SHAPE_NODE_TYPE, nodeId),
    updatedAt: Date.now(),
    inputSource: runtimeInputSources.get(key),
  };
};

async function getRuntimeRecordsForShape(
  filter?: BuildSessionRuntimeFilter
): Promise<BuildSessionRuntimeRecord[]> {
  const { queryAPI } = requireAdapterDeps();
  const persisted = filter?.nodeId
    ? await queryAPI.getBuildSessionRecord(filter.nodeId)
    : await queryAPI.listBuildSessionRecordsByStatus(RUNTIME_SESSION_STATUSES);
  const records = Array.isArray(persisted) ? persisted : persisted ? [persisted] : [];
  const runtimeRecords = records.map(toRuntimeRecord);
  const existing = new Set(
    runtimeRecords.map((record) => toRuntimeKey(SHAPE_NODE_TYPE, record.nodeId))
  );

  const syntheticCandidates = filter?.nodeId
    ? [{ nodeType: SHAPE_NODE_TYPE, nodeId: filter.nodeId }]
    : Array.from(runtimeNodeIndex.values()).filter((entry) => entry.nodeType === SHAPE_NODE_TYPE);
  for (const candidate of syntheticCandidates) {
    const key = toRuntimeKey(candidate.nodeType, candidate.nodeId);
    if (existing.has(key)) continue;
    const synthetic = toSyntheticRuntimeRecord(candidate.nodeId);
    if (!synthetic) continue;
    runtimeRecords.push(synthetic);
  }

  const statusesFilter = filter?.statuses;
  const filteredByStatus =
    statusesFilter && statusesFilter.length > 0
      ? runtimeRecords.filter((record) => statusesFilter.includes(record.status))
      : runtimeRecords;
  const filteredByActive = filter?.activeOnly
    ? filteredByStatus.filter((record) => record.isActive)
    : filteredByStatus;
  const sorted = filteredByActive.sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));
  return assertCanonicalBuildRuntimeRecords(sorted, SHAPE_NODE_TYPE);
}

const isActiveRuntimeStatus = (status: BuildSessionRuntimeStatus): boolean =>
  status === 'starting' ||
  status === 'running' ||
  status === 'pausing' ||
  status === 'resuming' ||
  status === 'finalizing';
