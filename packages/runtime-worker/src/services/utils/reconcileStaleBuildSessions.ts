import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';

type BuildSessionStatusRow = {
  nodeId: NodeId;
  status: string;
};

type BuildSessionHeartbeatRow = {
  nodeId: NodeId;
  lastHeartbeatAt: number;
};

type BuildSessionConfigRow = {
  nodeId: NodeId;
  startedAt: number;
};

interface BuildSessionConsistencyDB {
  open?: () => Promise<unknown>;
  buildSessionStatuses: {
    bulkGet: (keys: NodeId[]) => Promise<Array<BuildSessionStatusRow | undefined>>;
    where: (index: 'status') => {
      equals: (value: string) => {
        toArray: () => Promise<BuildSessionStatusRow[]>;
      };
    };
    update: (
      key: NodeId,
      changes: Partial<{ status: string; stopReason: string; completedAt: number }>
    ) => Promise<unknown>;
  };
  buildSessionHeartbeats: {
    bulkGet: (keys: NodeId[]) => Promise<Array<BuildSessionHeartbeatRow | undefined>>;
  };
  buildSessionConfigs: {
    bulkGet: (keys: NodeId[]) => Promise<Array<BuildSessionConfigRow | undefined>>;
  };
  buildTasks: {
    where: (index: '[nodeId+status]') => {
      anyOf: (keys: Array<[NodeId, 'running']>) => {
        count: () => Promise<number>;
      };
    };
  };
}

const DEFAULT_STALE_TIMEOUT_MS = 120_000;

export type ReconcileRunningBuildSessionsResult = {
  checkedNodeIds: NodeId[];
  activeNodeIds: NodeId[];
  repairedNodeIds: NodeId[];
};

const resolveLastActivityAt = (
  heartbeat: BuildSessionHeartbeatRow | undefined,
  config: BuildSessionConfigRow | undefined
): number | null => {
  if (typeof heartbeat?.lastHeartbeatAt === 'number' && Number.isFinite(heartbeat.lastHeartbeatAt)) {
    return heartbeat.lastHeartbeatAt;
  }
  if (typeof config?.startedAt === 'number' && Number.isFinite(config.startedAt)) {
    return config.startedAt;
  }
  return null;
};

const isStaleInactiveRunningSession = (params: {
  activeTaskCount: number;
  now: number;
  lastActivityAt: number | null;
  staleTimeoutMs: number;
}): boolean => {
  if (params.activeTaskCount > 0) return false;
  if (params.lastActivityAt === null) return true;
  return (params.now - params.lastActivityAt) > params.staleTimeoutMs;
};

export const reconcileRunningBuildSessions = async (params?: {
  nodeIds?: NodeId[];
  now?: number;
  staleTimeoutMs?: number;
  db?: BuildSessionConsistencyDB;
}): Promise<ReconcileRunningBuildSessionsResult> => {
  const db = params?.db ?? (ephemeralDB as unknown as BuildSessionConsistencyDB);
  const now = params?.now ?? Date.now();
  const staleTimeoutMs = params?.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS;

  await db.open?.();

  const candidateStatuses = params?.nodeIds && params.nodeIds.length > 0
    ? await db.buildSessionStatuses.bulkGet(params.nodeIds)
    : await db.buildSessionStatuses.where('status').equals('running').toArray();

  const runningStatuses = candidateStatuses.filter(
    (status): status is BuildSessionStatusRow => Boolean(status && status.status === 'running')
  );
  const runningNodeIds = runningStatuses.map((status) => status.nodeId);
  if (runningNodeIds.length === 0) {
    return {
      checkedNodeIds: [],
      activeNodeIds: [],
      repairedNodeIds: [],
    };
  }

  const [heartbeats, configs, activeTaskCounts] = await Promise.all([
    db.buildSessionHeartbeats.bulkGet(runningNodeIds),
    db.buildSessionConfigs.bulkGet(runningNodeIds),
    Promise.all(
      runningNodeIds.map((nodeId) =>
        db.buildTasks.where('[nodeId+status]').anyOf([
          [nodeId, 'running'],
        ]).count()
      )
    ),
  ]);

  const activeNodeIds: NodeId[] = [];
  const repairedNodeIds: NodeId[] = [];
  await Promise.all(
    runningNodeIds.map(async (nodeId, index) => {
      const activeTaskCount = activeTaskCounts[index] ?? 0;
      const lastActivityAt = resolveLastActivityAt(heartbeats[index], configs[index]);
      const isStale = isStaleInactiveRunningSession({
        activeTaskCount,
        now,
        lastActivityAt,
        staleTimeoutMs,
      });
      if (!isStale) {
        activeNodeIds.push(nodeId);
        return;
      }
      await db.buildSessionStatuses.update(nodeId, {
        status: 'failed',
        stopReason: 'unknown',
        completedAt: now,
      });
      repairedNodeIds.push(nodeId);
    })
  );

  return {
    checkedNodeIds: runningNodeIds,
    activeNodeIds,
    repairedNodeIds,
  };
};
