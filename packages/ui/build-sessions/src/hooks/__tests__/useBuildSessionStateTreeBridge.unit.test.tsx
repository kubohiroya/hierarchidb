// @vitest-environment jsdom

import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildSessionStateTreeBridge } from '../useBuildSessionStateTreeBridge.js';

type SubscriptionHandlers = {
  onTaskEvent: (event: unknown) => void;
  onProgressEvent: (event: unknown) => void;
  onSessionState: (event: unknown) => void;
  onHeartbeat: (event: unknown) => void;
  onWorkerLog: (event: unknown) => void;
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

const renderBridge = () =>
  renderHook(() =>
    useBuildSessionStateTreeBridge<StageId>({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
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
    workerMocks.subscribeAll.mockImplementation(
      async (_nodeType: NodeType, _nodeId: NodeId, handlers: SubscriptionHandlers) => {
        workerMocks.handlers = handlers;
        return workerMocks.unsubscribe;
      }
    );
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
