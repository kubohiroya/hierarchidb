import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';

const setPausedMock = vi.hoisted(() => vi.fn());
const emitProgressSnapshotMock = vi.hoisted(() => vi.fn(async () => undefined));
const upsertBuildSessionSnapshotMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateBuildSessionFromTasksMock = vi.hoisted(() => vi.fn(async () => undefined));
const clearActivePipelineRuntimeStateMock = vi.hoisted(() => vi.fn());
const countTaskQueueStatusesMock = vi.hoisted(() => vi.fn(async () => ({
  total: 0,
  running: 0,
  completed: 0,
  failed: 0,
  recycled: 0,
})));
const listTasksByStatusMock = vi.hoisted(() => vi.fn(async () => []));
const updateTaskMock = vi.hoisted(() => vi.fn(async () => undefined));

const activePipelines = vi.hoisted(() => new Set<string>());
const activePipelineRuns = vi.hoisted(() => new Map<string, string>());
const sessionAbortControllers = vi.hoisted(() => new Map<string, AbortController>());
const sessionWorkerInstances = vi.hoisted(() => new Map<string, { terminate?: () => void }>());

vi.mock('@hierarchidb/vt-orchestrator', () => ({
  VtTaskQueueDb: class {
    tasks = {
      where: () => ({
        equals: () => ({
          count: async () => 0,
          toArray: async () => [],
        }),
      }),
    };
  },
  deleteTasksByNode: async () => undefined,
  deleteTasksByIds: async () => undefined,
  listTasks: async () => [],
  listTasksByStage: async () => [],
  listTasksByStatus: (...args: Parameters<typeof listTasksByStatusMock>) => listTasksByStatusMock(...args),
  onTaskQueueUpdate: () => () => {},
  updateTask: (...args: Parameters<typeof updateTaskMock>) => updateTaskMock(...args),
}));

vi.mock('../../worker/api/shapeBuildRuntimeExecutionMetrics.js', () => ({
  shapeBuildRuntimeExecutionMetrics: {
    countTaskQueueStatuses: (...args: Parameters<typeof countTaskQueueStatusesMock>) => countTaskQueueStatusesMock(...args),
    setPaused: (...args: Parameters<typeof setPausedMock>) => setPausedMock(...args),
    waitIfPaused: async () => undefined,
    startSessionTracking: () => undefined,
    clearStalePipelineStateIfInactive: async () => false,
    clearActivePipelineRuntimeState: (...args: Parameters<typeof clearActivePipelineRuntimeStateMock>) =>
      clearActivePipelineRuntimeStateMock(...args),
    resolveProgressPhase: () => 'running',
    buildProgressPayloadFromTasks: async () => ({}),
    emitProgressSnapshot: (...args: Parameters<typeof emitProgressSnapshotMock>) => emitProgressSnapshotMock(...args),
    upsertBuildSessionSnapshot: (...args: Parameters<typeof upsertBuildSessionSnapshotMock>) =>
      upsertBuildSessionSnapshotMock(...args),
    updateBuildSessionFromTasks: (...args: Parameters<typeof updateBuildSessionFromTasksMock>) =>
      updateBuildSessionFromTasksMock(...args),
    summarizeTaskQueueStatus: () => ({ status: 'running', stage: 'source' }),
    progressCallbacks: new Map(),
    getShapeEntityHandler: () => ({ getEntity: async () => null }),
    activePipelines,
    activePipelineRuns,
    sessionAbortControllers,
    sessionWorkerInstances,
    isStopReason: (value: string) => ['route-leave', 'user-pause', 'failed', 'completed', 'unknown'].includes(value),
  },
}));

import { shapeBuildRuntimeExecutionControl } from '../../worker/api/shapeBuildRuntimeExecutionControl';

const asNodeId = (value: string): NodeId => value as NodeId;

describe('shape build pause command immediate stop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    activePipelines.clear();
    activePipelineRuns.clear();
    sessionAbortControllers.clear();
    sessionWorkerInstances.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sets paused state and aborts running controller immediately', async () => {
    const nodeId = asNodeId('shape-pause-1');
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');

    sessionAbortControllers.set(String(nodeId), abortController);

    await shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId,
      stopReason: 'user-pause',
    });

    expect(setPausedMock).toHaveBeenCalledWith(nodeId, true);
    expect(abortSpy).toHaveBeenCalledTimes(1);
  });
});
