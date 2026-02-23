import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent, ShapeBuildTaskSummary } from 'packages/build-api';
import { useShapeBuildTaskSync } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync';
import { useShapeBuildTasks } from '../../../components/build-progress/useShapeBuildTasks/useShapeBuildTasks';
import type { RawTaskSummary } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';

const hoistedMocks = vi.hoisted(() => ({
  initializeMock: vi.fn<[], Promise<void>>(),
  subscribeMock: vi.fn<[
    string,
    string,
    (event: BuildTaskUpdateEvent) => void
  ], Promise<() => void>>(),
  getBuildTasksMock: vi.fn(),
}));

const initializeMock = hoistedMocks.initializeMock;
const subscribeMock = hoistedMocks.subscribeMock;
const getBuildTasksMock = hoistedMocks.getBuildTasksMock;
let subscriber: ((event: BuildTaskUpdateEvent) => void) | null = null;
const dispatchedEvents: BuildTaskUpdateEvent[] = [];

vi.mock('@hierarchidb/ui-worker-client', () => {
  const getBridge = () => ({
    initialize: (...args: Parameters<typeof hoistedMocks.initializeMock>) =>
      hoistedMocks.initializeMock(...args),
    subscribeBuildTasks: (...args: Parameters<typeof hoistedMocks.subscribeMock>) =>
      hoistedMocks.subscribeMock(...args),
    getBuildTasks: (...args: Parameters<typeof hoistedMocks.getBuildTasksMock>) =>
      hoistedMocks.getBuildTasksMock(...args),
  });
  hoistedMocks.subscribeMock.mockImplementation(async (_nodeType, _nodeId, cb) => {
    subscriber = cb;
    return () => {
      if (subscriber === cb) {
        subscriber = null;
      }
    };
  });
  return {
    getBuildWorkerBridge: () => getBridge(),
  };
});

describe('useShapeBuildTaskSync', () => {
  it('reconciles buffered updates when snapshot arrives and does not clear in-flight work', async () => {
    const wrapper = () => {
      const [tasks, setTasks] = useState<ShapeBuildTaskSummary[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<Error | null>(null);
      const sync = useShapeBuildTaskSync({
        sessionNodeId: 'node-buffer',
        setTasks,
        setIsLoading,
        setError,
      });
      return {
        tasks,
        setTasks,
        isLoading,
        error,
        ...sync,
      };
    };

    const { result } = renderHook(wrapper);

    act(() => {
      result.current.handleUpdate({
        taskId: 'node-buffer:fetch:1',
        stage: 'fetch',
        status: 'running',
        progress: 20,
        message: 'before-snapshot',
        index: 1,
      } as RawTaskSummary);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(20);
    });

    act(() => {
      result.current.handleSnapshot([
        {
          taskId: 'node-buffer:fetch:1',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'snapshot',
          index: 1,
        } as RawTaskSummary,
        {
          taskId: 'node-buffer:fetch:2',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'snapshot-new',
          index: 2,
        } as RawTaskSummary,
      ]);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks[0]?.taskId).toBe('node-buffer:fetch:1');
      expect(result.current.tasks[0]?.status).toBe('queued');
      expect(result.current.tasks[0]?.progress).toBe(0);
      expect(result.current.tasks[1]?.taskId).toBe('node-buffer:fetch:2');
    });
  });

  it('does not regress terminal state with stale non-terminal updates', async () => {
    const { result } = renderHook(() => {
      const [tasks, setTasks] = useState<ShapeBuildTaskSummary[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<Error | null>(null);
      return {
        ...useShapeBuildTaskSync({
          sessionNodeId: 'node-terminal',
          setTasks,
          setIsLoading,
          setError,
        }),
        tasks,
      };
    });

    act(() => {
      result.current.handleSnapshot([
        {
          taskId: 'node-terminal:fetch:1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        } as RawTaskSummary,
      ]);
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });

    act(() => {
      result.current.handleUpdate({
        taskId: 'node-terminal:fetch:1',
        stage: 'fetch',
        status: 'running',
        progress: 80,
        message: 'stale',
        index: 1,
      } as RawTaskSummary);
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('Done');
    });
  });

  it('resets to no tasks when snapshot contains only terminal tasks and becomes empty snapshot', async () => {
    const { result } = renderHook(() => {
      const [tasks, setTasks] = useState<ShapeBuildTaskSummary[]>([]);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<Error | null>(null);
      return {
        ...useShapeBuildTaskSync({
          sessionNodeId: 'node-clear',
          setTasks,
          setIsLoading,
          setError,
        }),
        tasks,
      };
    });

    act(() => {
      result.current.handleSnapshot([
        {
          taskId: 'node-clear:fetch:1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'done',
          index: 1,
        } as RawTaskSummary,
      ]);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
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
    getBuildTasksMock.mockResolvedValue([]);
    dispatchedEvents.splice(0);
    subscriber = null;
    initializeMock.mockResolvedValue(undefined);
  });

  it('refreshes task snapshot from worker', async () => {
    getBuildTasksMock.mockResolvedValue([
      {
        taskId: 'node-refresh:fetch:JP:0',
        stage: 'fetch',
        status: 'completed',
        progress: 100,
        message: 'Done',
        index: 1,
      },
    ]);

    const { result } = renderHook(() => useShapeBuildTasks('node-refresh'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(getBuildTasksMock).toHaveBeenCalledWith('shape', 'node-refresh');
      expect(result.current.tasks).toHaveLength(1);
    });
  });

  it('replaces running tasks when receiving an empty snapshot event over a stream', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-stream'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });
    expect(subscriber).toBeDefined();

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stream',
        tasks: [
          {
            taskId: 'node-stream:fetch:0',
            stage: 'fetch',
            status: 'running',
            progress: 40,
            message: 'running',
            index: 1,
          },
        ],
      });
      if (subscriber) {
        dispatchedEvents.push({
          type: 'snapshot',
          nodeId: 'node-stream',
          tasks: [
            {
              taskId: 'node-stream:fetch:0',
              stage: 'fetch',
              status: 'running',
              progress: 40,
              message: 'running',
              index: 1,
            },
          ],
        });
      }
    });

    await waitFor(() => {
      expect(dispatchedEvents).toHaveLength(1);
      expect(result.current.tasks).toHaveLength(0);
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stream',
        tasks: [],
      });
      if (subscriber) {
        dispatchedEvents.push({
          type: 'snapshot',
          nodeId: 'node-stream',
          tasks: [],
        });
      }
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
  });

});
