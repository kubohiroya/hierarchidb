// @vitest-environment jsdom

import { unconditionalEventStreamer } from '@hierarchidb/build-runtime-services';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildSessionStateTreeBridge } from '../useBuildSessionStateTreeBridge.js';

type SubscriptionHandlers = {
  onTaskEvent: (event: unknown) => void;
  onProgressEvent: (event: unknown) => void;
  onSessionState: (event: unknown) => void;
  onHeartbeat: (event: unknown) => void;
};

const workerMocks = vi.hoisted(() => ({
  handlers: null as SubscriptionHandlers | null,
  initialize: vi.fn(async () => {}),
  subscribeAll: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getBuildWorkerBridge: () => ({
    initialize: workerMocks.initialize,
    subscribeAll: workerMocks.subscribeAll,
  }),
}));

const NODE_ID = 'node-1' as NodeId;
const NODE_TYPE = 'route' as NodeType;
const STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const;
type StageId = (typeof STAGE_IDS)[number];

const resolveStageId = (value: unknown): StageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  throw new Error(`unsupported stage: ${String(value)}`);
};

const renderBridge = (subscriptionTransport: 'worker' | 'same-realm' = 'worker') =>
  renderHook(() =>
    useBuildSessionStateTreeBridge<StageId>({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      subscriptionTransport,
      stageIds: STAGE_IDS,
      defaultActiveStageId: 'source',
      resolveStageId,
    })
  );

const requireHandlers = (): SubscriptionHandlers => {
  if (!workerMocks.handlers) {
    throw new Error('subscription handlers were not initialized');
  }
  return workerMocks.handlers;
};

describe('useBuildSessionStateTreeBridge canonical event consumption', () => {
  beforeEach(() => {
    workerMocks.handlers = null;
    workerMocks.initialize.mockClear();
    workerMocks.subscribeAll.mockReset();
    workerMocks.unsubscribe.mockClear();
    unconditionalEventStreamer.cleanup(NODE_ID);
    workerMocks.subscribeAll.mockImplementation(
      async (_nodeType: NodeType, _nodeId: NodeId, handlers: SubscriptionHandlers) => {
        workerMocks.handlers = handlers;
        return workerMocks.unsubscribe;
      }
    );
  });

  afterEach(() => {
    unconditionalEventStreamer.cleanup(NODE_ID);
  });

  it('does not synthesize aggregate progress from session status alone', async () => {
    const { result, unmount } = renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 1_000,
          stageId: 'source',
          stageStartedAt: 1_000,
          stageInactiveMs: 0,
        },
      });
    });

    expect(result.current.progressState.status?.status).toBe('running');
    expect(result.current.progressState.progress).toBeNull();

    act(() => {
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [],
          stageStartedAt: 1_000,
          stageInactiveMs: 0,
        },
      });
    });

    expect(result.current.progressState.progress).toMatchObject({
      stage: 'source',
      timestamp: 1_000,
      taskCounts: {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      },
      percentage: 0,
    });

    unmount();
    expect(workerMocks.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('applies task progress only after the authoritative stage snapshot and deduplicates by task version', async () => {
    const { result } = renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 2_000,
          stageId: 'source',
          stageStartedAt: 2_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'task-1',
          version: 2,
          stageId: 'source',
          value: 40,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'task-1',
              stage: 'source',
              status: 'running',
              progress: 10,
              version: 1,
            },
          ],
          stageStartedAt: 2_000,
          stageInactiveMs: 0,
        },
      });
    });

    expect(result.current.tree.tasks.byId['task-1']?.progress).toBe(40);
    expect(result.current.tree.tasks.byId['task-1']?.version).toBe(2);

    act(() => {
      requireHandlers().onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'task-1',
          version: 2,
          stageId: 'source',
          value: 80,
        },
      });
    });

    expect(result.current.tree.tasks.byId['task-1']?.progress).toBe(40);
  });

  it('does not let a delayed snapshot overwrite a newer accepted task version', async () => {
    const { result } = renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 2_000,
          stageId: 'source',
          stageStartedAt: 2_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'task-1',
              stage: 'source',
              status: 'queued',
              progress: 10,
              version: 1,
            },
          ],
          stageStartedAt: 2_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'task-1',
          version: 3,
          stageId: 'source',
          value: 80,
          message: '',
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'task-1',
              stage: 'source',
              status: 'running',
              progress: 20,
              version: 2,
            },
          ],
          stageStartedAt: 2_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'task-1',
          version: 3,
          stageId: 'source',
          value: 40,
        },
      });
    });

    expect(result.current.tree.tasks.byId['task-1']).toMatchObject({
      version: 3,
      status: 'running',
      progress: 80,
      message: '',
    });
  });

  it('derives counts and percentage from the active stage only', async () => {
    const { result } = renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 3_000,
          stageId: 'source',
          stageStartedAt: 3_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'source-task',
              stage: 'source',
              status: 'completed',
              progress: 100,
              version: 2,
            },
          ],
          stageStartedAt: 3_000,
          stageInactiveMs: 0,
          stageCompletedAt: 3_100,
        },
      });
    });

    expect(result.current.progressState.progress).toMatchObject({
      stage: 'source',
      percentage: 100,
      taskCounts: { total: 1, completed: 1 },
    });

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 3_000,
          stageId: 'geometry',
          stageStartedAt: 3_200,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'geometry',
          tasks: [
            {
              taskId: 'geometry-task',
              stage: 'geometry',
              status: 'running',
              progress: 0,
              version: 1,
            },
          ],
          stageStartedAt: 3_200,
          stageInactiveMs: 0,
        },
      });
    });

    expect(result.current.progressState.progress).toMatchObject({
      stage: 'geometry',
      percentage: 0,
      taskCounts: { total: 1, completed: 0 },
    });
  });

  it('resets snapshot readiness and tasks when a new session starts for the same node', async () => {
    const { result } = renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 4_000,
          stageId: 'source',
          stageStartedAt: 4_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'old-task',
              stage: 'source',
              status: 'completed',
              progress: 100,
              version: 2,
            },
          ],
          stageStartedAt: 4_000,
          stageInactiveMs: 0,
          stageCompletedAt: 4_100,
        },
      });
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'completed',
          isActive: false,
          startedAt: 4_000,
          completedAt: 4_100,
          stageId: 'source',
          stageStartedAt: 4_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'starting',
          isActive: true,
        },
      });
    });

    expect(result.current.tree.tasks.byId).toEqual({});
    expect(result.current.progressState.progress).toBeNull();

    act(() => {
      requireHandlers().onSessionState({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 5_000,
          stageId: 'source',
          stageStartedAt: 5_000,
          stageInactiveMs: 0,
        },
      });
      requireHandlers().onProgressEvent({
        type: 'taskProgressUpdated',
        payload: {
          taskId: 'new-task',
          version: 2,
          stageId: 'source',
          value: 50,
        },
      });
      requireHandlers().onTaskEvent({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [
            {
              taskId: 'new-task',
              stage: 'source',
              status: 'running',
              progress: 0,
              version: 1,
            },
          ],
          stageStartedAt: 5_000,
          stageInactiveMs: 0,
        },
      });
    });

    expect(result.current.tree.tasks.byId['new-task']).toMatchObject({
      version: 2,
      progress: 50,
    });
  });

  it('subscribes to same-realm canonical events without initializing the worker bridge', async () => {
    const { result, unmount } = renderBridge('same-realm');

    act(() => {
      unconditionalEventStreamer.emitEvent(NODE_ID, 'session-state', {
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: NODE_ID,
          phase: 'running',
          isActive: true,
          startedAt: 6_000,
          stageId: 'source',
          stageStartedAt: 6_000,
          stageInactiveMs: 0,
        },
      });
      unconditionalEventStreamer.emitEvent(NODE_ID, 'stage-snapshot', {
        type: 'stageSnapshotUpdated',
        payload: {
          stageId: 'source',
          tasks: [],
          stageStartedAt: 6_000,
          stageInactiveMs: 0,
        },
      });
    });

    expect(workerMocks.initialize).not.toHaveBeenCalled();
    expect(workerMocks.subscribeAll).not.toHaveBeenCalled();
    expect(result.current.progressState.progress).toMatchObject({
      stage: 'source',
      status: 'running',
    });
    unmount();
  });

  it('throws when canonical progress or session timing violates the contract', async () => {
    renderBridge();
    await waitFor(() => expect(workerMocks.handlers).not.toBeNull());

    expect(() => {
      act(() => {
        requireHandlers().onSessionState({
          type: 'sessionStatusUpdated',
          payload: {
            nodeId: NODE_ID,
            phase: 'running',
            isActive: true,
          },
        });
      });
    }).toThrow(/startedAt is required/);

    expect(() => {
      act(() => {
        requireHandlers().onProgressEvent({
          type: 'taskProgressUpdated',
          payload: {
            taskId: 'task-1',
            version: 1,
            stageId: 'source',
            value: 101,
          },
        });
      });
    }).toThrow(/must be within 0\.\.100/);

    expect(() => {
      act(() => {
        requireHandlers().onSessionState({
          type: 'sessionStatusUpdated',
          payload: {
            nodeId: NODE_ID,
            phase: 'paused',
            isActive: true,
            startedAt: 1_000,
          },
        });
      });
    }).toThrow(/is invalid for phase paused/);
  });
});
