import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import {
  type CanonicalBuildSessionKernelConsumer,
  createCanonicalBuildSessionSubscriptionKernel,
} from '../createCanonicalBuildSessionSubscriptionKernel.js';

const NODE_ID = 'kernel-node' as NodeId;

const createConsumer = <StageId extends string>() => ({
  onReset: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onReset']>(),
  onSessionStatus: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onSessionStatus']>(),
  onStageSnapshot: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onStageSnapshot']>(),
  onTaskProgress: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onTaskProgress']>(),
  onHeartbeat: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onHeartbeat']>(),
  onError: vi.fn<CanonicalBuildSessionKernelConsumer<StageId>['onError']>(),
});

const createStageResolver = <StageId extends string>(stageIds: readonly StageId[]) => {
  const accepted = new Set<string>(stageIds);
  return (value: unknown): StageId => {
    if (typeof value === 'string' && accepted.has(value)) return value as StageId;
    throw new Error(`unsupported configured stage: ${String(value)}`);
  };
};

const createSessionEvent = (stageId: string, startedAt = 100) => ({
  type: 'sessionStatusUpdated' as const,
  payload: {
    nodeId: NODE_ID,
    phase: 'running' as const,
    isActive: true,
    startedAt,
    stageId,
    stageStartedAt: startedAt,
    stageInactiveMs: 0,
  },
});

const createSnapshotEvent = (stageId: string, version = 1) => ({
  type: 'stageSnapshotUpdated' as const,
  payload: {
    stageId,
    stageStartedAt: 100,
    stageInactiveMs: 0,
    tasks: [
      {
        taskId: `${stageId}-task`,
        stage: stageId,
        status: 'running',
        progress: 0,
        version,
      },
    ],
  },
});

const createProgressEvent = (stageId: string, version: number, value: number) => ({
  type: 'taskProgressUpdated' as const,
  payload: {
    taskId: `${stageId}-task`,
    stageId,
    version,
    value,
  },
});

describe('createCanonicalBuildSessionSubscriptionKernel', () => {
  it.each([
    ['shape', ['source', 'geometry', 'tileEmit'] as const],
    ['route', ['source', 'geometry', 'tileEmit'] as const],
    ['location', ['source'] as const],
  ])('uses only the explicit %s stage configuration', (_plugin, stageIds) => {
    type StageId = (typeof stageIds)[number];
    const consumer = createConsumer<StageId>();
    const kernel = createCanonicalBuildSessionSubscriptionKernel({
      nodeId: NODE_ID,
      resolveStageId: createStageResolver(stageIds),
      consumer,
    });
    const configuredStage = stageIds[0];
    if (!configuredStage) throw new Error('test stage configuration must not be empty');

    kernel.handlers.onSessionState(createSessionEvent(configuredStage));
    kernel.handlers.onTaskEvent(createSnapshotEvent(configuredStage));

    expect(consumer.onSessionStatus).toHaveBeenCalledOnce();
    expect(consumer.onStageSnapshot).toHaveBeenCalledOnce();
    expect(() => kernel.handlers.onTaskEvent(createSnapshotEvent('plugin-specific-stage'))).toThrow(
      /unsupported configured stage/
    );
  });

  it('buffers pre-snapshot progress and applies only newer task-scoped versions', () => {
    const stageIds = ['source'] as const;
    type StageId = (typeof stageIds)[number];
    const consumer = createConsumer<StageId>();
    const kernel = createCanonicalBuildSessionSubscriptionKernel({
      nodeId: NODE_ID,
      resolveStageId: createStageResolver(stageIds),
      consumer,
    });

    kernel.handlers.onProgressEvent(createProgressEvent('source', 2, 20));
    kernel.handlers.onProgressEvent(createProgressEvent('source', 1, 10));
    expect(consumer.onTaskProgress).not.toHaveBeenCalled();

    kernel.handlers.onTaskEvent(createSnapshotEvent('source', 1));
    expect(consumer.onStageSnapshot).toHaveBeenCalledOnce();
    expect(consumer.onTaskProgress).toHaveBeenCalledTimes(1);
    expect(consumer.onTaskProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ taskId: 'source-task', version: 2, value: 20 })
    );

    kernel.handlers.onProgressEvent(createProgressEvent('source', 2, 25));
    kernel.handlers.onProgressEvent(createProgressEvent('source', 3, 30));
    expect(consumer.onTaskProgress).toHaveBeenCalledTimes(2);
    expect(consumer.onTaskProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 3, value: 30 })
    );
  });

  it('resets task membership and buffering when a new session starts', () => {
    const stageIds = ['source'] as const;
    type StageId = (typeof stageIds)[number];
    const consumer = createConsumer<StageId>();
    const kernel = createCanonicalBuildSessionSubscriptionKernel({
      nodeId: NODE_ID,
      resolveStageId: createStageResolver(stageIds),
      consumer,
    });

    kernel.handlers.onSessionState(createSessionEvent('source'));
    kernel.handlers.onTaskEvent(createSnapshotEvent('source'));
    kernel.handlers.onSessionState({
      type: 'sessionStatusUpdated',
      payload: {
        nodeId: NODE_ID,
        phase: 'starting',
        isActive: true,
      },
    });
    kernel.handlers.onProgressEvent(createProgressEvent('source', 2, 20));

    expect(consumer.onReset).toHaveBeenCalledOnce();
    expect(consumer.onTaskProgress).not.toHaveBeenCalled();
  });

  it('fails fast for invalid progress and progress without authoritative membership', () => {
    const stageIds = ['source'] as const;
    type StageId = (typeof stageIds)[number];
    const consumer = createConsumer<StageId>();
    const kernel = createCanonicalBuildSessionSubscriptionKernel({
      nodeId: NODE_ID,
      resolveStageId: createStageResolver(stageIds),
      consumer,
    });

    expect(() => kernel.handlers.onProgressEvent(createProgressEvent('source', 1, 101))).toThrow(
      /must be within 0\.\.100/
    );
    kernel.handlers.onProgressEvent(createProgressEvent('source', 2, 20));
    expect(() =>
      kernel.handlers.onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          stageStartedAt: 100,
          stageInactiveMs: 0,
          tasks: [],
        },
      })
    ).toThrow(/buffered progress references task absent/);
    expect(consumer.onError).toHaveBeenCalledTimes(2);
  });
});
