import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import {
  deleteTasksByIds,
  putTasks,
  updateTask,
  VtTaskQueueDb,
} from '@hierarchidb/vt-orchestrator';

// Mock shapeBuildRuntime (used by shapeBuildAPI internally for startBuildSession etc.)
// The 4-channel subscription methods use shapeBuildRuntimeCore directly, so we don't
// need to mock the callbacks here - we import them from the real module below.
vi.mock('../../worker/api/shapeBuildRuntime.js', () => ({
  shapeBuildRuntime: {
    sessionStateCallbacks: new Map(),
    stageSnapshotCallbacks: new Map(),
    heartbeatCallbacks: new Map(),
    taskProgressCallbacks: new Map(),
    taskCallbacks: new Map(),
    invokeShapeBuildCommand: async () => undefined,
    startBuildSessionInternal: async () => 'node-1' as NodeId,
    getBuildSessionInternal: async () => undefined,
    ensureTaskQueueSeeded: async () => undefined,
    listTasks: async () => [],
    mapTaskQueueRecordToTaskSummary: () => ({}),
    buildTaskSummarySnapshot: async () => [],
    getShapeEntityHandler: () => ({ getEntity: async () => null }),
    getPauseState: () => ({ paused: false, waiters: [] }),
    buildTaskQueueSummary: async () => ({ progress: { percentage: 0, total: 0, completed: 0, failed: 0, skipped: 0 }, status: 'idle' }),
    onTaskQueueUpdate: () => () => { },
  },
}));

// Import the real sessionStateCallbacks from shapeBuildRuntimeCore (not the mock)
import {
  sessionStateCallbacks,
  stageSnapshotCallbacks,
  heartbeatCallbacks,
  taskProgressCallbacks,
} from '../../worker/api/shapeBuildRuntimeCore';
import { shapeBuildAPI } from '../../worker/api/shapeBuildAPI';
import {
  emitStageSnapshotUpdated,
  readStartedStageTiming,
  validateSessionTimingContract,
  validateStageTimingContract,
} from '../../worker/api/eventEmissionConstantsUtils';
import { unconditionalEventStreamer } from '../../worker/api/eventBuffering';
import { shapeQueryAPIImpl } from '../../services/build/ShapeBuildAPIClient';

const asNodeId = (value: string): NodeId => value as NodeId;

describe('shapeBuildAPI 4-channel subscriptions', () => {
  const taskQueue = new VtTaskQueueDb();

  beforeEach(() => {
    sessionStateCallbacks.clear();
    stageSnapshotCallbacks.clear();
    heartbeatCallbacks.clear();
    taskProgressCallbacks.clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await taskQueue.tasks.clear();
  });

  it('registers and dispatches all subscription channels', () => {
    const nodeId = asNodeId('shape-sub-1');
    const sessionCallback = vi.fn();
    const snapshotCallback = vi.fn();
    const heartbeatCallback = vi.fn();
    const taskProgressCallback = vi.fn();

    const offSession = shapeBuildAPI.subscribeSessionState(nodeId, sessionCallback as never);
    const offSnapshot = shapeBuildAPI.subscribeStageSnapshots(nodeId, snapshotCallback as never);
    const offHeartbeat = shapeBuildAPI.subscribeHeartbeat(nodeId, heartbeatCallback as never);
    const offTaskProgress = shapeBuildAPI.subscribeTaskProgress(nodeId, taskProgressCallback as never);

    // Invoke the stored callbacks directly to simulate event delivery
    sessionStateCallbacks.get(String(nodeId))?.callback?.({ kind: 'session' });
    stageSnapshotCallbacks.get(String(nodeId))?.callback?.({ kind: 'snapshot' });
    heartbeatCallbacks.get(String(nodeId))?.callback?.({ kind: 'heartbeat' });
    taskProgressCallbacks.get(String(nodeId))?.callback?.({ kind: 'task-progress' });

    expect(sessionCallback).toHaveBeenCalledWith({ kind: 'session' });
    expect(snapshotCallback).toHaveBeenCalledWith({ kind: 'snapshot' });
    expect(heartbeatCallback).toHaveBeenCalledWith({ kind: 'heartbeat' });
    expect(taskProgressCallback).toHaveBeenCalledWith({ kind: 'task-progress' });

    offSession();
    offSnapshot();
    offHeartbeat();
    offTaskProgress();

    expect(sessionStateCallbacks.has(String(nodeId))).toBe(false);
    expect(stageSnapshotCallbacks.has(String(nodeId))).toBe(false);
    expect(heartbeatCallbacks.has(String(nodeId))).toBe(false);
    expect(taskProgressCallbacks.has(String(nodeId))).toBe(false);
  });

  it('emits full stage snapshots after task status transitions and deletion', async () => {
    const nodeId = asNodeId(`shape-stage-status-${Date.now()}-${Math.random()}`);
    const task: TaskQueueRecord = {
      taskId: `${String(nodeId)}:source:JP:0`,
      nodeId,
      version: 1,
      stage: 'source',
      status: 'queued',
      index: 0,
      progress: 0,
    };
    const snapshotCallback = vi.fn();
    const unsubscribe = shapeBuildAPI.subscribeStageSnapshots(nodeId, snapshotCallback);

    await putTasks(taskQueue, [task]);
    expect(snapshotCallback).not.toHaveBeenCalled();
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'source',
        tasks: [task],
        stageStartedAt: 1_000,
        stageInactiveMs: 0,
      },
    });
    expect(snapshotCallback).toHaveBeenCalledTimes(1);

    await updateTask(taskQueue, task.taskId, {
      status: 'running',
      progress: 0,
    });
    await vi.waitFor(() => {
      expect(snapshotCallback).toHaveBeenCalledTimes(2);
    });
    expect(snapshotCallback.mock.calls[1]?.[0]?.payload.tasks).toMatchObject([
      { taskId: task.taskId, status: 'running' },
    ]);
    expect(snapshotCallback.mock.calls[1]?.[0]?.payload.stageCompletedAt).toBeUndefined();

    await updateTask(taskQueue, task.taskId, {
      progress: 50,
      message: 'halfway',
    });
    expect(snapshotCallback).toHaveBeenCalledTimes(2);

    await updateTask(taskQueue, task.taskId, {
      status: 'completed',
      progress: 100,
      completedAt: 1_600,
      display: { kind: 'skip', key: 'canonical-skip' },
      message: 'Skipped by the canonical filter',
    });
    await vi.waitFor(() => {
      expect(snapshotCallback).toHaveBeenCalledTimes(3);
    });
    expect(snapshotCallback.mock.calls[2]?.[0]?.payload.tasks).toMatchObject([
      {
        taskId: task.taskId,
        status: 'completed',
        progress: 100,
        display: { kind: 'skip', key: 'canonical-skip' },
        message: 'Skipped by the canonical filter',
      },
    ]);
    expect(snapshotCallback.mock.calls[2]?.[0]?.payload.stageCompletedAt).toBe(1_600);

    await deleteTasksByIds(taskQueue, [task.taskId]);
    await vi.waitFor(() => {
      expect(snapshotCallback).toHaveBeenCalledTimes(4);
    });
    expect(snapshotCallback.mock.calls[3]?.[0]?.payload.tasks).toEqual([]);
    expect(snapshotCallback.mock.calls[3]?.[0]?.payload.stageCompletedAt).toBeUndefined();

    unsubscribe();
  });

  it('deduplicates task updates using the canonical task status', async () => {
    const nodeId = asNodeId(`shape-stage-canonical-status-${Date.now()}-${Math.random()}`);
    const task: TaskQueueRecord = {
      taskId: `${String(nodeId)}:tileEmit:0`,
      nodeId,
      version: 1,
      stage: 'tileEmit',
      status: 'completed',
      index: 0,
      progress: 10,
    };
    const snapshotCallback = vi.fn();
    const unsubscribe = shapeBuildAPI.subscribeStageSnapshots(nodeId, snapshotCallback);

    await putTasks(taskQueue, [task]);
    unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', {
      type: 'stageSnapshotUpdated',
      payload: {
        stageId: 'tileEmit',
        tasks: [{ ...task, status: 'running' }],
        stageStartedAt: 1_000,
        stageInactiveMs: 0,
      },
    });
    expect(snapshotCallback).toHaveBeenCalledTimes(1);

    await updateTask(taskQueue, task.taskId, { progress: 20 });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(snapshotCallback).toHaveBeenCalledTimes(1);

    await updateTask(taskQueue, task.taskId, {
      status: 'completed',
      progress: 100,
      completedAt: 1_600,
    });
    await vi.waitFor(() => {
      expect(snapshotCallback).toHaveBeenCalledTimes(2);
    });
    expect(snapshotCallback.mock.calls[1]?.[0]?.payload.tasks).toMatchObject([
      { taskId: task.taskId, status: 'completed', progress: 100 },
    ]);

    unsubscribe();
  });

  it('rejects contract-invalid persisted tasks before canonical summary mapping', async () => {
    const nodeId = asNodeId(`shape-stage-invalid-task-${Date.now()}-${Math.random()}`);
    const taskId = `${String(nodeId)}:source:JP:0`;
    await taskQueue.tasks.put({
      taskId,
      nodeId,
      version: 0,
      stage: 'source',
      status: 'queued',
      index: 0,
      progress: 0,
    });

    await expect(emitStageSnapshotUpdated(nodeId, 'source', 1_000, 0)).rejects.toThrow(
      'task.version',
    );

    await taskQueue.tasks.update(taskId, { version: 1, progress: 101 });
    await expect(emitStageSnapshotUpdated(nodeId, 'source', 1_000, 0)).rejects.toThrow(
      'task.progress',
    );
  });

  it('reports initial snapshot failures without an unhandled rejection', async () => {
    const nodeId = asNodeId(`shape-stage-initial-error-${Date.now()}-${Math.random()}`);
    const failure = new Error('initial stage snapshot read failed');
    vi.spyOn(shapeQueryAPIImpl, 'getBuildSessionRecord').mockRejectedValueOnce(failure);
    const logCallback = vi.fn();
    const unsubscribeLog = shapeBuildAPI.subscribeWorkerLog(nodeId, logCallback);
    const unsubscribeSnapshot = shapeBuildAPI.subscribeStageSnapshots(nodeId, vi.fn());

    await vi.waitFor(() => {
      expect(logCallback).toHaveBeenCalledWith(expect.objectContaining({
        level: 'error',
        data: {
          stage: 'initial-subscription',
          error: failure.message,
        },
      }));
    });

    unsubscribeSnapshot();
    unsubscribeLog();
  });
});

describe('build session event timing contracts', () => {
  it('accepts valid session and stage timing', () => {
    expect(() => validateSessionTimingContract('running', {
      startedAt: 1_000,
      inactiveMs: 100,
      stageId: 'source',
      stageStartedAt: 1_100,
      stageInactiveMs: 50,
    })).not.toThrow();
    expect(() => validateStageTimingContract(1_100, 50, 1_500)).not.toThrow();
  });

  it('rejects missing and non-finite started timestamps', () => {
    expect(() => validateSessionTimingContract('running', {})).toThrowError(
      'startedAt is required for phase running',
    );
    expect(() => validateSessionTimingContract('running', {
      startedAt: 1_000,
      inactiveMs: Number.POSITIVE_INFINITY,
    })).toThrowError('inactiveMs must be a finite non-negative number');
    expect(() => validateStageTimingContract(Number.NaN, 0)).toThrowError(
      'stageStartedAt must be a finite non-negative number',
    );
    expect(() => validateSessionTimingContract('failed', {
      startedAt: 1_000,
    })).toThrowError('completedAt is required for phase failed');
    expect(() => validateSessionTimingContract('completed', {
      startedAt: 1_000,
    })).toThrowError('completedAt is required for phase completed');
  });

  it('rejects negative inactive duration and reversed completion timestamps', () => {
    expect(() => validateStageTimingContract(1_000, -1)).toThrowError(
      'stageInactiveMs must be a finite non-negative number',
    );
    expect(() => validateStageTimingContract(1_000, 100, 1_050)).toThrowError(
      'stage duration must be finite and non-negative',
    );
    expect(() => validateSessionTimingContract('completed', {
      startedAt: 1_000,
      inactiveMs: 100,
      completedAt: 1_050,
    })).toThrowError('session duration must be finite and non-negative');
  });

  it('distinguishes an unstarted stage from an invalid started-stage record', () => {
    const baseRecord = {
      nodeId: 'shape-1' as NodeId,
      status: 'running' as const,
      startedAt: 1_000,
      updatedAt: 1_000,
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
      stages: {},
    };
    expect(readStartedStageTiming(baseRecord)).toBeNull();
    expect(() => readStartedStageTiming({
      ...baseRecord,
      stageId: 'source',
    })).toThrowError('stageStartedAt must be a finite non-negative number');
    expect(() => readStartedStageTiming({
      ...baseRecord,
      stageStartedAt: 1_100,
    })).toThrowError('stage timing must be absent when stageId is absent');
  });
});
