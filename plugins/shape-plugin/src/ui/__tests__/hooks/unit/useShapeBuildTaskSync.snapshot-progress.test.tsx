import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent, ShapeBuildTaskSummary } from 'packages/build-api';
import { useShapeBuildTaskSync } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync';
import { useShapeBuildTasks } from '../../../components/build-progress/useShapeBuildTasks/useShapeBuildTasks';
import type { RawTaskSummary } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';

type SubscriberRecord = {
  nodeId: string;
  callback: (event: BuildTaskUpdateEvent) => void;
  unsubscribed: boolean;
};

const hoistedMocks = vi.hoisted(() => ({
  initializeMock: vi.fn<[], Promise<void>>(),
  subscribeMock: vi.fn<[
    string,
    string,
    (event: BuildTaskUpdateEvent) => void,
  ], Promise<() => void>>(),
  getBuildTasksMock: vi.fn(),
}));

const initializeMock = hoistedMocks.initializeMock;
const subscribeMock = hoistedMocks.subscribeMock;
const getBuildTasksMock = hoistedMocks.getBuildTasksMock;

const subscribers: SubscriberRecord[] = [];

vi.mock('@hierarchidb/ui-worker-client', () => {
  const getBridge = () => ({
    initialize: (...args: Parameters<typeof hoistedMocks.initializeMock>) =>
      hoistedMocks.initializeMock(...args),
    subscribeBuildTasks: (...args: Parameters<typeof hoistedMocks.subscribeMock>) =>
      hoistedMocks.subscribeMock(...args),
    getBuildTasks: (...args: Parameters<typeof hoistedMocks.getBuildTasksMock>) =>
      hoistedMocks.getBuildTasksMock(...args),
  });
  hoistedMocks.subscribeMock.mockImplementation(async (_nodeType, nodeId, callback) => {
    const record: SubscriberRecord = { nodeId, callback, unsubscribed: false };
    subscribers.push(record);
    return () => {
      record.unsubscribed = true;
    };
  });
  return {
    getBuildWorkerBridge: () => getBridge(),
  };
});

const emitEvent = (_nodeId: string, event: BuildTaskUpdateEvent) => {
  const target = [...subscribers].reverse().find((item) => !item.unsubscribed);
  if (!target) {
    throw new Error('No active build task subscriber');
  }
  act(() => {
    target.callback(event);
  });
};

const makeTaskSummary = (
  taskId: string,
  overrides: Partial<RawTaskSummary>,
): RawTaskSummary => ({
  taskId,
  stage: 'fetch',
  status: 'queued',
  progress: 0,
  message: 'queued',
  index: 0,
  ...overrides,
});

describe('useShapeBuildTaskSync', () => {
  it('replaces running work when snapshot arrives, even if empty', async () => {
    const { result } = renderHook(() => {
      const [tasks, setTasksState] = useState<ShapeBuildTaskSummary[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<Error | null>(null);
      const setTasks = (next: ShapeBuildTaskSummary[]) => {
        setTasksState(next);
      };
      return {
        tasks,
        isLoading,
        error,
        ...useShapeBuildTaskSync({
          sessionNodeId: 'node-running',
          setTasks,
          setIsLoading,
          setError,
        }),
      };
    });

    act(() => {
      result.current.handleUpdate({
        taskId: 'node-running:fetch:1',
        stage: 'fetch',
        status: 'running',
        progress: 35,
        message: 'running',
        index: 1,
      } as RawTaskSummary);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(35);
    });

    act(() => {
      result.current.handleSnapshot([]);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
  });

});

describe('useShapeBuildTasks', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    getBuildTasksMock.mockReset();
    subscribers.splice(0, subscribers.length);
    initializeMock.mockResolvedValue(undefined);
    getBuildTasksMock.mockResolvedValue([]);
  });

  it('updates task state from initial snapshot and terminal-progress updates', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-progress'));
    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    emitEvent('node-progress', {
      type: 'snapshot',
      nodeId: 'node-progress',
      tasks: [
        makeTaskSummary('node-progress:fetch:0', { status: 'running', progress: 20, index: 1 }),
        makeTaskSummary('node-progress:fetch:1', { status: 'running', progress: 10, index: 2 }),
      ],
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.snapshotTaskCountByStage).toEqual({ fetch: 2 });
      expect(result.current.terminalTaskCountByStage).toEqual({});
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[1]?.status).toBe('running');
    });

    emitEvent('node-progress', {
      type: 'update',
      nodeId: 'node-progress',
      task: makeTaskSummary('node-progress:fetch:0', {
        status: 'completed',
        progress: 100,
        message: 'done',
        index: 1,
      }),
    });

    await waitFor(() => {
      expect(result.current.terminalTaskCountByStage).toEqual({ fetch: 1 });
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('done');
    });
  });
});
