import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent } from 'packages/build-api';
import { useShapeBuildTasks } from '../../../components/build-progress/useShapeBuildTasks/useShapeBuildTasks';

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
let consoleLogSpy: ReturnType<typeof vi.spyOn> | null = null;
let consoleDebugSpy: ReturnType<typeof vi.spyOn> | null = null;

const setTaskSyncDebugConfig = (
  config: Partial<Record<'taskUpdate100' | 'runningResidue' | 'all', boolean>> | undefined,
): void => {
  const scope = globalThis as typeof globalThis & {
    __HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__?: Partial<Record<'taskUpdate100' | 'runningResidue' | 'all', boolean>>;
  };
  if (!config) {
    delete scope.__HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__;
    return;
  }
  scope.__HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__ = config;
};

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

describe('useShapeBuildTasks', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    getBuildTasksMock.mockReset();
    getBuildTasksMock.mockResolvedValue([]);
    subscriber = null;
    initializeMock.mockResolvedValue(undefined);
    setTaskSyncDebugConfig(undefined);
    consoleLogSpy?.mockRestore();
    consoleDebugSpy?.mockRestore();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('applies snapshot and update events without polling', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-1'));
    expect(result.current.isTaskStreamReady).toBe(false);

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-1',
        tasks: [
          {
            taskId: 'task-1',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',
            index: 1,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isTaskStreamReady).toBe(true);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-1',
        task: {
          taskId: 'task-1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-1',
        task: {
          taskId: 'task-1',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Late',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
    });

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

  it('keeps canonical stage in task records', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-stage-priority'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-priority',
        tasks: [
          {
            taskId: 'task-stage-priority',
            stage: 'vt',
            status: 'queued',
            progress: 0,
            index: 1,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.stage).toBe('vt');
    });
  });

  it('keeps completed 100% when a running 100% update arrives later', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-2'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-2',
        tasks: [
          {
            taskId: 'task-2',
            stage: 'vt',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 1,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2',
        task: {
          taskId: 'task-2',
          stage: 'vt',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2',
        task: {
          taskId: 'task-2',
          stage: 'vt',
          status: 'running',
          progress: 100,
          message: 'Late running',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('keeps completed message stable when late phase updates arrive', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-2b'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2b',
        task: {
          taskId: 'task-2b',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'transform done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform done');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2b',
        task: {
          taskId: 'task-2b',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'finalize',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform done');
    });
  });

  it('ignores later running updates after completed terminal status', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-2d'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2d',
        task: {
          taskId: 'task-2d',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'Cache write done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('Cache write done');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2d',
        task: {
          taskId: 'task-2d',
          stage: 'transform',
          status: 'running',
          progress: 97,
          message: 'Encode start',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('Cache write done');
    });
  });

  it('preserves completed terminal state against later non-terminal updates', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-8'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-8',
        task: {
          taskId: 'node-8:fetch:US:0',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('Done');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-8',
        task: {
          taskId: 'node-8:fetch:US:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Recovered',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('Done');
    });
  });

  it('preserves failed terminal state and keeps failed at 100%', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-9'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-9',
        task: {
          taskId: 'node-9:transform:DE:0',
          stage: 'transform',
          status: 'failed',
          progress: 40,
          message: 'transform failed',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('failed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-9',
        task: {
          taskId: 'node-9:transform:DE:0',
          stage: 'transform',
          status: 'running',
          progress: 95,
          message: 'retrying',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('failed');
      expect(result.current.tasks[0]?.progress).toBe(100);
      expect(result.current.tasks[0]?.message).toBe('transform failed');
    });
  });

  it('treats skipped display task as terminal and keeps 100% progress', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-10'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-10',
        task: {
          taskId: 'node-10:vt:BR:0',
          stage: 'vt',
          status: 'running',
          progress: 30,
          message: 'skipped: vt source missing',
          index: 1,
          display: { kind: 'skip' },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-10',
        task: {
          taskId: 'node-10:vt:BR:0',
          stage: 'vt',
          status: 'running',
          progress: 45,
          message: 'running',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('promotes completed message from phase marker to concrete completion message once', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-2c'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2c',
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'encode:start',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('encode:start');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2c',
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'transform cache stored',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform cache stored');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2c',
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'post-process',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform cache stored');
    });
  });

  it('normalizes running 100% to completed across stages', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-3'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-3',
        tasks: [
          {
            taskId: 'task-3',
            stage: 'fetch',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 1,
          },
          {
            taskId: 'task-4',
            stage: 'transform',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 2,
          },
          {
            taskId: 'task-5',
            stage: 'vt',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 3,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[1]?.status).toBe('completed');
      expect(result.current.tasks[2]?.status).toBe('completed');
    });
  });

  it('keeps non-terminal status at less than 100 progress', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-3b'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-3b',
        tasks: [
          {
            taskId: 'task-3b',
            stage: 'fetch',
            status: 'recycled',
            progress: 100,
            message: 'recycled for retry',
            index: 1,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('recycled');
      expect(result.current.tasks[0]?.progress).toBe(99);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-3b',
        task: {
          taskId: 'task-3b',
          stage: 'fetch',
          status: 'running',
          progress: 100,
          message: 'still active',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('recycled');
      expect(result.current.tasks[0]?.progress).toBe(99);
    });
  });

  it('logs TaskUpdate100 with parsed scope when update progress reaches 100', async () => {
    setTaskSyncDebugConfig({ taskUpdate100: true });
    renderHook(() => useShapeBuildTasks('node-4'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-4',
        task: {
          taskId: 'node-4:fetch:JPN:1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('[TaskUpdate100] JPN, 1, Done, completed');
    });
  });

  it('does not log TaskUpdate100 for non-100 updates', async () => {
    renderHook(() => useShapeBuildTasks('node-5'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-5',
        task: {
          taskId: 'node-5:fetch:JPN:1',
          stage: 'fetch',
          status: 'running',
          progress: 99,
          message: 'Working',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[TaskUpdate100]'));
    });
  });

  it('ignores task events when nodeId does not match the active subscription', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-mismatch'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-other',
        task: {
          taskId: 'node-other:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'running',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
  });

  it('keeps terminal status when duplicate updates arrive', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-6'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6',
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'Queued',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('queued');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6',
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Running',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6',
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'Late queued',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6',
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('drops stale tasks that no longer exist in snapshot', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-7'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-7',
        tasks: [
          {
            taskId: 'node-7:fetch:ABW:0',
            stage: 'fetch',
            status: 'running',
            progress: 70,
            message: 'Running',
            index: 1,
          },
          {
            taskId: 'node-7:fetch:ABW:1',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',
            index: 2,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-7',
        tasks: [
          {
            taskId: 'node-7:fetch:ABW:1',
            stage: 'fetch',
            status: 'running',
            progress: 10,
            message: 'Start',
            index: 2,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.taskId).toBe('node-7:fetch:ABW:1');
    });
  });

  it('ignores updates for different nodeId in active subscription', async () => {
    getBuildTasksMock.mockResolvedValue([]);
    const { result } = renderHook(() => useShapeBuildTasks('node-mismatch'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-other',
        task: {
          taskId: 'node-other:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 15,
          message: 'foreign',
          index: 1,
        },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.tasks).toHaveLength(0);
  });

  it('drops stale subscriber updates after node switch', async () => {
    getBuildTasksMock.mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ nodeId }: { nodeId: string }) => useShapeBuildTasks(nodeId),
      { initialProps: { nodeId: 'node-old' } },
    );

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledTimes(1);
    });

    const staleSubscriber = subscriber;
    rerender({ nodeId: 'node-new' });

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalledTimes(2);
    });

    act(() => {
      staleSubscriber?.({
        type: 'update',
        nodeId: 'node-old',
        task: {
          taskId: 'node-old:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 20,
          message: 'stale',
          index: 1,
        },
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.tasks).toHaveLength(0);

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-new',
        task: {
          taskId: 'node-new:fetch:JP:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'queued',
          index: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.taskId).toBe('node-new:fetch:JP:0');
    });
  });

  it('composes vt parent input summary metadata into task message', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-vt-meta'));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-vt-meta',
        task: {
          taskId: 'node-vt-meta:vt:2:6:123',
          stage: 'vt',
          status: 'running',
          progress: 30,
          message: 'tiles 12/40',
          index: 1,
          metadata: {
            vtParentInputSummary: {
              parentTile: { z: 6, x: 15, y: 23 },
              intersectingFeatureCount: 9,
              intersectingGeojsonByteSize: 2316360,
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.message).toBe(
        'tiles 12/40 | vt parent input z=6 x=15 y=23 intersects(features=9, geojsonBytes=2316360)',
      );
    });
  });

  it('can refresh task snapshot manually when updates are absent', async () => {
    getBuildTasksMock.mockResolvedValue([
      {
        taskId: 'node-refresh-missing:fetch:JP:0',
        stage: 'fetch',
        status: 'running',
        progress: 20,
        message: 'Running',
        index: 1,
      },
    ]);

    const { result } = renderHook(() => useShapeBuildTasks('node-refresh-missing'));

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    expect(getBuildTasksMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(getBuildTasksMock).toHaveBeenCalledWith('shape', 'node-refresh-missing');
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('flushes task updates via timeout fallback when requestAnimationFrame does not fire', async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 4242);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useShapeBuildTasks('node-raf-fallback'));

      await act(async () => {
        await Promise.resolve();
      });

      expect(subscribeMock).toHaveBeenCalled();

      act(() => {
        subscriber?.({
          type: 'update',
          nodeId: 'node-raf-fallback',
          task: {
            taskId: 'node-raf-fallback:fetch:JP:0',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',
            index: 1,
          },
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
        await Promise.resolve();
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.status).toBe('queued');
      expect(result.current.isLoading).toBe(false);
      expect(cancelSpy).toHaveBeenCalledWith(4242);
    } finally {
      rafSpy.mockRestore();
      cancelSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
