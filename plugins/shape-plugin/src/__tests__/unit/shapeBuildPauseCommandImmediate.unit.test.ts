import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ActivePipeline = {
  promise: Promise<void>;
  abortController: AbortController;
  runId: string;
};

const setPausedMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateBuildSessionMock = vi.hoisted(() => vi.fn(async () => undefined));
const emitSessionLifecyclePhaseUpdatedMock = vi.hoisted(() => vi.fn());
const activePipelineStore = vi.hoisted(() => new Map<string, ActivePipeline>());
const invalidatedRunIds = vi.hoisted(() => new Map<string, string>());
const countTaskQueueStatusesMock = vi.hoisted(() =>
  vi.fn(async () => ({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    recycled: 0,
  }))
);
const getBuildSessionRecordMock = vi.hoisted(() =>
  vi.fn(async (nodeId: string) => ({
    nodeId,
    status: 'running' as const,
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

vi.mock('../../services/build/ShapeBuildAPIClient.js', () => ({
  ephemeralShapeAPIImpl: {},
  shapeMutationAPIImpl: {
    upsertBuildSession: vi.fn(async () => undefined),
    updateBuildSession: (...args: Parameters<typeof updateBuildSessionMock>) =>
      updateBuildSessionMock(...args),
  },
  shapeQueryAPIImpl: {
    getBuildSessionRecord: (...args: Parameters<typeof getBuildSessionRecordMock>) =>
      getBuildSessionRecordMock(...args),
  },
}));

vi.mock('../../worker/api/eventEmissionConstants.js', () => ({
  emitSessionLifecyclePhaseUpdated: (
    ...args: Parameters<typeof emitSessionLifecyclePhaseUpdatedMock>
  ) => emitSessionLifecyclePhaseUpdatedMock(...args),
  emitSessionStatusUpdated: vi.fn(),
  emitStageSnapshotUpdated: vi.fn(async () => undefined),
  readStartedStageTiming: vi.fn(() => null),
}));

vi.mock('../../worker/api/shapeBuildRuntimeCore.js', () => ({
  countTaskQueueStatuses: (...args: Parameters<typeof countTaskQueueStatusesMock>) =>
    countTaskQueueStatusesMock(...args),
  setPaused: (...args: Parameters<typeof setPausedMock>) => setPausedMock(...args),
  waitIfPaused: async () => undefined,
  getShapeEntityHandler: () => ({ getEntity: async () => null }),
  getActivePipeline: (nodeId: NodeId) => activePipelineStore.get(String(nodeId)) ?? null,
  registerActivePipeline: (nodeId: NodeId, active: ActivePipeline) => {
    activePipelineStore.set(String(nodeId), active);
  },
  clearActivePipeline: (nodeId: NodeId, runId: string) => {
    const active = activePipelineStore.get(String(nodeId));
    if (active?.runId !== runId) return false;
    activePipelineStore.delete(String(nodeId));
    invalidatedRunIds.delete(String(nodeId));
    return true;
  },
  invalidateActivePipeline: (nodeId: NodeId, runId: string) => {
    const active = activePipelineStore.get(String(nodeId));
    if (active?.runId !== runId) return false;
    invalidatedRunIds.set(String(nodeId), runId);
    return true;
  },
  isActivePipelineRunCurrent: (nodeId: NodeId, runId: string) =>
    activePipelineStore.get(String(nodeId))?.runId === runId &&
    invalidatedRunIds.get(String(nodeId)) !== runId,
}));

import {
  SHAPE_PIPELINE_SHUTDOWN_TIMEOUT_MS,
  shapeBuildRuntimeExecutionControl,
} from '../../worker/api/shapeBuildRuntimeExecutionControl';

const asNodeId = (value: string): NodeId => value as NodeId;
const TEST_NODE_ID = asNodeId('shape-pause-1');

const createDeferred = (): {
  promise: Promise<void>;
  resolve: () => void;
} => {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => {
      if (!resolvePromise) throw new Error('deferred resolver is missing');
      resolvePromise();
    },
  };
};

describe('shape build pause command pipeline drain', () => {
  beforeEach(async () => {
    if (!ephemeralDB.isOpen()) await ephemeralDB.open();
    await ephemeralDB.clearNodeData(TEST_NODE_ID);
    vi.clearAllMocks();
    activePipelineStore.clear();
    invalidatedRunIds.clear();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (!ephemeralDB.isOpen()) await ephemeralDB.open();
    await ephemeralDB.clearNodeData(TEST_NODE_ID);
  });

  it('keeps pausing until the exact pipeline promise settles', async () => {
    const deferred = createDeferred();
    const abortController = new AbortController();
    const abortSpy = vi.spyOn(abortController, 'abort');
    await ephemeralDB.buildTasks.put({
      taskId: 'source-running-1',
      nodeId: TEST_NODE_ID,
      version: 1,
      stage: 'source',
      status: 'running',
      index: 0,
      progress: 42,
      startedAt: 10,
    });
    activePipelineStore.set(String(TEST_NODE_ID), {
      promise: deferred.promise,
      abortController,
      runId: 'run-1',
    });

    const command = shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId: TEST_NODE_ID,
      stopReason: 'user-pause',
    });

    await vi.waitFor(() => {
      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(setPausedMock).toHaveBeenCalledWith(TEST_NODE_ID, true);
      expect(emitSessionLifecyclePhaseUpdatedMock).toHaveBeenCalledWith(
        TEST_NODE_ID,
        expect.objectContaining({ stopReason: 'user-pause' }),
        'pausing'
      );
    });
    expect(updateBuildSessionMock).not.toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({ status: 'paused' })
    );
    expect(activePipelineStore.get(String(TEST_NODE_ID))?.runId).toBe('run-1');
    expect((await ephemeralDB.buildTasks.get('source-running-1'))?.status).toBe('running');

    deferred.resolve();
    await command;

    expect(activePipelineStore.has(String(TEST_NODE_ID))).toBe(false);
    expect(await ephemeralDB.buildTasks.get('source-running-1')).toEqual(
      expect.objectContaining({
        status: 'queued',
        progress: 42,
      })
    );
    expect(countTaskQueueStatusesMock).toHaveBeenCalledTimes(1);
    expect(updateBuildSessionMock).toHaveBeenCalledWith(TEST_NODE_ID, {
      status: 'paused',
      stopReason: 'user-pause',
      canResume: true,
      completedAt: undefined,
    });
  });

  it('persists failed and rejects with a typed error on shutdown timeout', async () => {
    vi.useFakeTimers();
    const deferred = createDeferred();
    activePipelineStore.set(String(TEST_NODE_ID), {
      promise: deferred.promise,
      abortController: new AbortController(),
      runId: 'run-timeout',
    });

    const command = shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId: TEST_NODE_ID,
      stopReason: 'route-leave',
    });
    const rejection = expect(command).rejects.toMatchObject({
      name: 'ShapeBuildPauseShutdownTimeoutError',
      code: 'SHAPE_BUILD_PAUSE_SHUTDOWN_TIMEOUT',
    });
    await vi.advanceTimersByTimeAsync(SHAPE_PIPELINE_SHUTDOWN_TIMEOUT_MS);

    await rejection;
    expect(invalidatedRunIds.get(String(TEST_NODE_ID))).toBe('run-timeout');
    expect(activePipelineStore.get(String(TEST_NODE_ID))?.runId).toBe('run-timeout');
    expect(updateBuildSessionMock).toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({
        status: 'failed',
        stopReason: 'failed',
        canResume: false,
      })
    );
    expect(updateBuildSessionMock).not.toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({ status: 'paused' })
    );
    expect(setPausedMock).toHaveBeenLastCalledWith(TEST_NODE_ID, false);

    deferred.resolve();
    await deferred.promise;
    await Promise.resolve();
    expect(activePipelineStore.has(String(TEST_NODE_ID))).toBe(false);
  });

  it('fails instead of synthesizing paused when no active pipeline exists', async () => {
    await expect(
      shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
        nodeId: TEST_NODE_ID,
        stopReason: 'user-pause',
      })
    ).rejects.toMatchObject({
      name: 'ShapeBuildPauseActivePipelineMissingError',
      code: 'SHAPE_BUILD_PAUSE_ACTIVE_PIPELINE_MISSING',
    });
    expect(updateBuildSessionMock).toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({
        status: 'failed',
        stopReason: 'failed',
        canResume: false,
      })
    );
    expect(setPausedMock).toHaveBeenLastCalledWith(TEST_NODE_ID, false);
  });

  it('fails and clears the internal pause state when running tasks remain after drain', async () => {
    const deferred = createDeferred();
    activePipelineStore.set(String(TEST_NODE_ID), {
      promise: deferred.promise,
      abortController: new AbortController(),
      runId: 'run-drain-invariant',
    });
    countTaskQueueStatusesMock.mockResolvedValueOnce({
      total: 1,
      running: 1,
      completed: 0,
      failed: 0,
      recycled: 0,
    });

    const command = shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId: TEST_NODE_ID,
      stopReason: 'user-pause',
    });
    deferred.resolve();

    await expect(command).rejects.toMatchObject({
      name: 'ShapeBuildPauseDrainInvariantError',
    });
    expect(setPausedMock).toHaveBeenLastCalledWith(TEST_NODE_ID, false);
    expect(updateBuildSessionMock).toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({
        status: 'failed',
        stopReason: 'failed',
        canResume: false,
      })
    );
    expect(updateBuildSessionMock).not.toHaveBeenCalledWith(
      TEST_NODE_ID,
      expect.objectContaining({ status: 'paused' })
    );
    expect(activePipelineStore.has(String(TEST_NODE_ID))).toBe(false);
  });

  it('does not abort or pause a replacement run that appears during session lookup', async () => {
    const sessionRecord = {
      nodeId: String(TEST_NODE_ID),
      status: 'running' as const,
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
    };
    let resolveSessionRead: ((value: typeof sessionRecord) => void) | undefined;
    getBuildSessionRecordMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSessionRead = resolve;
      })
    );
    const originalAbortController = new AbortController();
    const replacementAbortController = new AbortController();
    const originalAbortSpy = vi.spyOn(originalAbortController, 'abort');
    const replacementAbortSpy = vi.spyOn(replacementAbortController, 'abort');
    activePipelineStore.set(String(TEST_NODE_ID), {
      promise: Promise.resolve(),
      abortController: originalAbortController,
      runId: 'run-original',
    });

    const command = shapeBuildRuntimeExecutionControl.invokeShapeBuildCommand('session/pause', {
      nodeId: TEST_NODE_ID,
      stopReason: 'user-pause',
    });
    await vi.waitFor(() => expect(getBuildSessionRecordMock).toHaveBeenCalled());

    activePipelineStore.set(String(TEST_NODE_ID), {
      promise: Promise.resolve(),
      abortController: replacementAbortController,
      runId: 'run-replacement',
    });
    if (!resolveSessionRead) throw new Error('session read resolver is missing');
    resolveSessionRead(sessionRecord);

    await expect(command).rejects.toMatchObject({
      name: 'ShapeBuildPauseActivePipelineMissingError',
      code: 'SHAPE_BUILD_PAUSE_ACTIVE_PIPELINE_MISSING',
    });
    expect(originalAbortSpy).not.toHaveBeenCalled();
    expect(replacementAbortSpy).not.toHaveBeenCalled();
    expect(setPausedMock).not.toHaveBeenCalled();
    expect(activePipelineStore.get(String(TEST_NODE_ID))?.runId).toBe('run-replacement');
  });
});
