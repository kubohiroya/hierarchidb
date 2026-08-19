import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setPausedMock = vi.hoisted(() => vi.fn());
const upsertBuildSessionSnapshotMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateBuildSessionFromTasksMock = vi.hoisted(() => vi.fn(async () => undefined));
const getBuildSessionRecordMock = vi.hoisted(() =>
  vi.fn(async (nodeId: string) => ({
    nodeId,
    status: 'paused' as const,
    startedAt: 1,
    updatedAt: 1,
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    },
    stages: {},
  }))
);
const countTaskQueueStatusesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    recycled: 0,
  }))
);
// In-memory store for AbortControllers (replaces the old sessionAbortControllers Map)
const abortControllerStore = vi.hoisted(() => new Map<string, AbortController | null>());
const setSessionAbortControllerMock = vi.hoisted(() =>
  vi.fn((nodeId: string, ac: AbortController | null) => {
    abortControllerStore.set(nodeId, ac);
  })
);
const clearSessionAbortControllerMock = vi.hoisted(() =>
  vi.fn((nodeId: string) => {
    abortControllerStore.delete(nodeId);
  })
);
const getSessionAbortControllerMock = vi.hoisted(() =>
  vi.fn((nodeId: string) => abortControllerStore.get(nodeId) ?? null)
);

vi.mock('../../services/build/ShapeBuildAPIClient.js', () => ({
  ephemeralShapeAPIImpl: {},
  shapeMutationAPIImpl: {
    upsertBuildSession: (...args: Parameters<typeof upsertBuildSessionSnapshotMock>) =>
      upsertBuildSessionSnapshotMock(...args),
    updateBuildSession: (...args: Parameters<typeof updateBuildSessionFromTasksMock>) =>
      updateBuildSessionFromTasksMock(...args),
  },
  shapeQueryAPIImpl: {
    getBuildSessionRecord: (...args: Parameters<typeof getBuildSessionRecordMock>) =>
      getBuildSessionRecordMock(...args),
  },
}));

// Mock shapeBuildRuntimeCore which is the module that shapeBuildRuntimeExecutionControl
// destructures setPaused, waitIfPaused, etc. from.
vi.mock('../../worker/api/shapeBuildRuntimeCore.js', () => ({
  countTaskQueueStatuses: (...args: Parameters<typeof countTaskQueueStatusesMock>) =>
    countTaskQueueStatusesMock(...args),
  setPaused: (...args: Parameters<typeof setPausedMock>) => setPausedMock(...args),
  waitIfPaused: async () => undefined,
  resolveProgressPhase: () => 'running',
  buildProgressPayloadFromTasks: async () => ({}),
  progressCallbacks: new Map(),
  getShapeEntityHandler: () => ({ getEntity: async () => null }),
  listTasks: async () => [],
  onTaskQueueUpdate: () => () => {},
  ensureTaskQueueSeeded: async () => undefined,
  mapTaskQueueRecordToTaskSummary: (t: unknown) => t,
  buildTaskSummarySnapshot: async () => [],
  buildTaskQueueSummary: async () => ({}),
  getPauseState: () => ({ paused: false, waiters: [] }),
  resolveSessionStatus: () => 'running',
  resolveSessionLastActivity: () => Date.now(),
  taskCallbacks: new Map(),
  sessionStateCallbacks: new Map(),
  stageSnapshotCallbacks: new Map(),
  heartbeatCallbacks: new Map(),
  taskProgressCallbacks: new Map(),
  workerLogCallbacks: new Map(),
  setSessionAbortController: (...args: Parameters<typeof setSessionAbortControllerMock>) =>
    setSessionAbortControllerMock(...args),
  clearSessionAbortController: (...args: Parameters<typeof clearSessionAbortControllerMock>) =>
    clearSessionAbortControllerMock(...args),
  getSessionAbortController: (...args: Parameters<typeof getSessionAbortControllerMock>) =>
    getSessionAbortControllerMock(...args),
}));

import { shapeBuildRuntimeExecutionControl } from '../../worker/api/shapeBuildRuntimeExecutionControl';

const asNodeId = (value: string): NodeId => value as NodeId;
const TEST_NODE_ID = asNodeId('shape-pause-1');

describe('shape build pause command immediate stop', () => {
  beforeEach(async () => {
    if (!ephemeralDB.isOpen()) {
      await ephemeralDB.open();
    }
    await ephemeralDB.clearNodeData(TEST_NODE_ID);
    vi.clearAllMocks();
    abortControllerStore.clear();
  });

  afterEach(async () => {
    if (!ephemeralDB.isOpen()) {
      await ephemeralDB.open();
    }
    await ephemeralDB.clearNodeData(TEST_NODE_ID);
  });

  it('sets paused state and aborts running controller immediately', async () => {
    const nodeId = TEST_NODE_ID;
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');

    abortControllerStore.set(String(nodeId), abortController);

    await shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId,
      stopReason: 'user-pause',
    });

    expect(setPausedMock).toHaveBeenCalledWith(nodeId, true);
    expect(abortSpy).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(updateBuildSessionFromTasksMock).toHaveBeenCalledWith(nodeId, {
        status: 'paused',
        stopReason: 'user-pause',
        canResume: true,
        completedAt: undefined,
      });
      expect(countTaskQueueStatusesMock).toHaveBeenCalledTimes(2);
    });
  });
});
