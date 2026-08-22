import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { reconcileRunningBuildSessions } from '../reconcileStaleBuildSessions.js';

const asNodeId = (value: string): NodeId => value as NodeId;

type MockDb = {
  open: ReturnType<typeof vi.fn>;
  buildSessionStatuses: {
    bulkGet: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  buildSessionHeartbeats: {
    bulkGet: ReturnType<typeof vi.fn>;
  };
  buildSessionConfigs: {
    bulkGet: ReturnType<typeof vi.fn>;
  };
  buildTasks: {
    where: ReturnType<typeof vi.fn>;
  };
};

const createDbMock = (params?: {
  statuses?: Array<{ nodeId: NodeId; status: string } | undefined>;
  heartbeatByNode?: Record<string, number | undefined>;
  startedAtByNode?: Record<string, number | undefined>;
  activeTaskCountByNode?: Record<string, number>;
}) => {
  const statuses = params?.statuses ?? [];
  const heartbeatByNode = params?.heartbeatByNode ?? {};
  const startedAtByNode = params?.startedAtByNode ?? {};
  const activeTaskCountByNode = params?.activeTaskCountByNode ?? {};

  const update = vi.fn(async () => 1);
  const bulkGetStatuses = vi.fn(async (nodeIds: NodeId[]) =>
    nodeIds.map((nodeId) => statuses.find((status) => status?.nodeId === nodeId))
  );
  const statusWhere = vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(async () =>
        statuses.filter((status): status is { nodeId: NodeId; status: string } => Boolean(status))
      ),
    })),
  }));
  const bulkGetHeartbeats = vi.fn(async (nodeIds: NodeId[]) =>
    nodeIds.map((nodeId) => {
      const value = heartbeatByNode[String(nodeId)];
      return typeof value === 'number' ? { nodeId, lastHeartbeatAt: value } : undefined;
    })
  );
  const bulkGetConfigs = vi.fn(async (nodeIds: NodeId[]) =>
    nodeIds.map((nodeId) => {
      const value = startedAtByNode[String(nodeId)];
      return typeof value === 'number' ? { nodeId, startedAt: value } : undefined;
    })
  );
  const whereTasks = vi.fn((_index: '[nodeId+status]') => ({
    anyOf: (keys: Array<[NodeId, 'running']>) => {
      const nodeId = keys[0]?.[0];
      return {
        count: vi.fn(async () => activeTaskCountByNode[String(nodeId)] ?? 0),
      };
    },
  }));

  const db: MockDb = {
    open: vi.fn(async () => undefined),
    buildSessionStatuses: {
      bulkGet: bulkGetStatuses,
      where: statusWhere,
      update,
    },
    buildSessionHeartbeats: {
      bulkGet: bulkGetHeartbeats,
    },
    buildSessionConfigs: {
      bulkGet: bulkGetConfigs,
    },
    buildTasks: {
      where: whereTasks,
    },
  };

  return { db, update, whereTasks };
};

describe('reconcileRunningBuildSessions', () => {
  it('keeps active running session when running tasks exist', async () => {
    const nodeId = asNodeId('shape-1');
    const now = 1_000_000;
    const { db, update } = createDbMock({
      statuses: [{ nodeId, status: 'running' }],
      heartbeatByNode: { 'shape-1': now - 500_000 },
      startedAtByNode: { 'shape-1': now - 500_000 },
      activeTaskCountByNode: { 'shape-1': 2 },
    });

    const result = await reconcileRunningBuildSessions({
      db: db as never,
      nodeIds: [nodeId],
      now,
      staleTimeoutMs: 1_000,
    });

    expect(result.activeNodeIds).toEqual([nodeId]);
    expect(result.repairedNodeIds).toEqual([]);
    expect(update).not.toHaveBeenCalled();
  });

  it('repairs stale running session when no active tasks and heartbeat is stale', async () => {
    const nodeId = asNodeId('shape-1');
    const now = 1_000_000;
    const { db, update } = createDbMock({
      statuses: [{ nodeId, status: 'running' }],
      heartbeatByNode: { 'shape-1': now - 10_000 },
      startedAtByNode: { 'shape-1': now - 50_000 },
      activeTaskCountByNode: { 'shape-1': 0 },
    });

    const result = await reconcileRunningBuildSessions({
      db: db as never,
      nodeIds: [nodeId],
      now,
      staleTimeoutMs: 1_000,
    });

    expect(result.activeNodeIds).toEqual([]);
    expect(result.repairedNodeIds).toEqual([nodeId]);
    expect(update).toHaveBeenCalledWith(nodeId, {
      status: 'failed',
      stopReason: 'unknown',
      completedAt: now,
    });
  });

  it('repairs running session when only queued tasks remain and no running task exists', async () => {
    const nodeId = asNodeId('shape-1');
    const now = 1_000_000;
    const { db, update } = createDbMock({
      statuses: [{ nodeId, status: 'running' }],
      heartbeatByNode: { 'shape-1': now - 20_000 },
      startedAtByNode: { 'shape-1': now - 20_000 },
      activeTaskCountByNode: { 'shape-1': 0 },
    });

    const result = await reconcileRunningBuildSessions({
      db: db as never,
      nodeIds: [nodeId],
      now,
      staleTimeoutMs: 1_000,
    });

    expect(result.activeNodeIds).toEqual([]);
    expect(result.repairedNodeIds).toEqual([nodeId]);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('repairs running session without heartbeat/config and no active tasks', async () => {
    const nodeId = asNodeId('shape-1');
    const now = 1_000_000;
    const { db, update } = createDbMock({
      statuses: [{ nodeId, status: 'running' }],
      activeTaskCountByNode: { 'shape-1': 0 },
    });

    const result = await reconcileRunningBuildSessions({
      db: db as never,
      nodeIds: [nodeId],
      now,
      staleTimeoutMs: 30_000,
    });

    expect(result.activeNodeIds).toEqual([]);
    expect(result.repairedNodeIds).toEqual([nodeId]);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
