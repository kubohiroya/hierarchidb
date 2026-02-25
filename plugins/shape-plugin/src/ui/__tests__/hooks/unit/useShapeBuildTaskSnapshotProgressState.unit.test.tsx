import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { useShapeBuildTaskSnapshotProgressState } from '../../../components/build-progress/useShapeBuildTaskSnapshotProgressState/useShapeBuildTaskSnapshotProgressState';
import type { NodeId } from '@hierarchidb/core-types';
import { getDefaultStore } from 'jotai';
import {
  tasksAtom,
  tasksErrorAtom,
  tasksLoadingAtom,
} from '../../../atoms/shapeBuildProgressAtoms';

const hoistedMocks = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  subscribeMock: vi.fn(),
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

describe('useShapeBuildTaskSnapshotProgressState', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    getBuildTasksMock.mockReset();
    getBuildTasksMock.mockResolvedValue([]);
    subscriber = null;
    initializeMock.mockResolvedValue(undefined);
    const store = getDefaultStore();
    store.set(tasksAtom, []);
    store.set(tasksLoadingAtom, false);
    //store.set(tasksErrorAtom, null);
    setTaskSyncDebugConfig(undefined);
    consoleLogSpy?.mockRestore();
    consoleDebugSpy?.mockRestore();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('applies snapshot and update events without polling', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-1' as NodeId));
    expect(result.current.isTaskSnapshotProgressConnected).toBe(false);

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-1' as NodeId,
        tasks: [
          {
            taskId: 'task-1',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isTaskSnapshotProgressConnected).toBe(true);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-1' as NodeId,
        task: {
          taskId: 'task-1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-1' as NodeId,
        task: {
          taskId: 'task-1',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Late'
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
      },
    ]);

    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-refresh' as NodeId));

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
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-stage-priority' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-priority' as NodeId,
        tasks: [
          {
            taskId: 'task-stage-priority',
            stage: 'vt',
            status: 'queued',
            progress: 0,

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.stage).toBe('vt');
    });
  });

  it('keeps completed 100% when a running 100% update arrives later', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-2' as NodeId,
        tasks: [
          {
            taskId: 'task-2',
            stage: 'vt',
            status: 'running',
            progress: 100,
            message: 'Cache saving',

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
        nodeId: 'node-2' as NodeId,
        task: {
          taskId: 'task-2',
          stage: 'vt',
          status: 'completed',
          progress: 100,
          message: 'Done'
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
        nodeId: 'node-2' as NodeId,
        task: {
          taskId: 'task-2',
          stage: 'vt',
          status: 'running',
          progress: 100,
          message: 'Late running'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('does not downgrade running status with equal progress from snapshot', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2x' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2x' as NodeId,
        task: {
          taskId: 'node-2x:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 42,
          message: 'running'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(42);
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-2x' as NodeId,
        tasks: [
          {
            taskId: 'node-2x:fetch:JP:0',
            stage: 'fetch',
            status: 'queued',
            progress: 42,
            message: 'queued',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.message).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(42);
    });
  });

  it('keeps completed message stable when late phase updates arrive', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2b' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2b' as NodeId,
        task: {
          taskId: 'task-2b',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'transform done',
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
        nodeId: 'node-2b' as NodeId,
        task: {
          taskId: 'task-2b',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'finalize'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform done');
    });
  });

  it('ignores later running updates after completed terminal status', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2d' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2d' as NodeId,
        task: {
          taskId: 'task-2d',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'Cache write done'
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
        nodeId: 'node-2d' as NodeId,
        task: {
          taskId: 'task-2d',
          stage: 'transform',
          status: 'running',
          progress: 97,
          message: 'Encode start'
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
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-8' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-8' as NodeId,
        task: {
          taskId: 'node-8:fetch:US:0',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done'
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
        nodeId: 'node-8' as NodeId,
        task: {
          taskId: 'node-8:fetch:US:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Recovered'
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
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-9' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-9' as NodeId,
        task: {
          taskId: 'node-9:transform:DE:0',
          stage: 'transform',
          status: 'failed',
          progress: 40,
          message: 'transform failed'
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
        nodeId: 'node-9' as NodeId,
        task: {
          taskId: 'node-9:transform:DE:0',
          stage: 'transform',
          status: 'running',
          progress: 95,
          message: 'retrying'
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
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-10' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-10' as NodeId,
        task: {
          taskId: 'node-10:vt:BR:0',
          stage: 'vt',
          status: 'running',
          progress: 30,
          message: 'skipped: vt source missing',
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
        nodeId: 'node-10' as NodeId,
        task: {
          taskId: 'node-10:vt:BR:0',
          stage: 'vt',
          status: 'running',
          progress: 45,
          message: 'running'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('keeps tasks from unrelated stages when stage snapshot arrives', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-stage-multi' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-multi' as NodeId,
        tasks: [
          {
            taskId: 'node-stage-multi:fetch:JP:0',
            stage: 'fetch',
            status: 'completed',
            progress: 100,
            message: 'Fetch done'
          },
          {
            taskId: 'node-stage-multi:transform:JP:1',
            stage: 'transform',
            status: 'running',
            progress: 10,
            message: 'Transform running',

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks.map((task) => task.taskId)).toEqual([
        'node-stage-multi:fetch:JP:0',
        'node-stage-multi:transform:JP:1',
      ]);
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-multi' as NodeId,
        tasks: [
          {
            taskId: 'node-stage-multi:vt:JP:2',
            stage: 'vt',
            status: 'running',
            progress: 0,
            message: 'VT queued',

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(3);
      expect(result.current.tasks.map((task) => task.taskId)).toEqual([
        'node-stage-multi:fetch:JP:0',
        'node-stage-multi:transform:JP:1',
        'node-stage-multi:vt:JP:2',
      ]);
    });
  });

  it('preserves completed stage task counts when stage snapshot changes', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-stage-count-retain' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-count-retain' as NodeId,
        tasks: [
          {
            taskId: 'node-stage-count-retain:fetch:JP:0',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',

          },
          {
            taskId: 'node-stage-count-retain:fetch:JP:1',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.snapshotTaskCountByStage).toMatchObject({ fetch: 2 });
      expect(result.current.terminalTaskCountByStage).toMatchObject({});
      expect(result.current.tasks).toHaveLength(2);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-stage-count-retain' as NodeId,
        task: {
          taskId: 'node-stage-count-retain:fetch:JP:0',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 1 });
      expect(result.current.tasks).toHaveLength(2);
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-count-retain' as NodeId,
        tasks: [
          {
            taskId: 'node-stage-count-retain:fetch:JP:1',
            stage: 'fetch',
            status: 'running',
            progress: 10,
            message: 'Running',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.snapshotTaskCountByStage).toMatchObject({ fetch: 2 });
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 1 });
      expect(result.current.tasks).toHaveLength(2);
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-stage-count-retain' as NodeId,
        task: {
          taskId: 'node-stage-count-retain:fetch:JP:1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done',

        },
      });
    });

    await waitFor(() => {
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 2 });
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-stage-count-retain' as NodeId,
        tasks: [
          {
            taskId: 'node-stage-count-retain:vt:JP:0',
            stage: 'vt',
            status: 'running',
            progress: 0,
            message: 'VT queued',

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.snapshotTaskCountByStage).toMatchObject({ fetch: 2, vt: 1 });
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 2 });
      expect(result.current.tasks).toHaveLength(3);
    });
  });

  it('preserves terminal counts for non-incoming stages when new stage snapshot arrives', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2e' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-2e' as NodeId,
        tasks: [
          {
            taskId: 'node-2e:fetch:JP:0',
            stage: 'fetch',
            status: 'completed',
            progress: 100,
            message: 'Fetch done',

          },
          {
            taskId: 'node-2e:fetch:JP:1',
            stage: 'fetch',
            status: 'completed',
            progress: 100,
            message: 'Fetch done',

          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 2 });
      expect(result.current.snapshotTaskCountByStage).toMatchObject({ fetch: 2 });
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-2e' as NodeId,
        tasks: [
          {
            taskId: 'node-2e:vt:JP:0',
            stage: 'vt',
            status: 'running',
            progress: 10,
            message: 'VT queued',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.terminalTaskCountByStage).toMatchObject({ fetch: 2 });
      expect(result.current.snapshotTaskCountByStage).toMatchObject({ fetch: 2, vt: 1 });
      expect(result.current.tasks).toHaveLength(3);
    });
  });

  it('promotes completed message from phase marker to concrete completion message once', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-2c' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-2c' as NodeId,
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'encode:start'
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
        nodeId: 'node-2c' as NodeId,
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'completed',
          progress: 100,
          message: 'transform cache stored'
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
        nodeId: 'node-2c' as NodeId,
        task: {
          taskId: 'task-2c',
          stage: 'transform',
          status: 'running',
          progress: 100,
          message: 'post-process'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.message).toBe('transform cache stored');
    });
  });

  it('normalizes running 100% to completed across stages', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-3' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-3' as NodeId,
        tasks: [
          {
            taskId: 'task-3',
            stage: 'fetch',
            status: 'running',
            progress: 100,
            message: 'Cache saving',

          },
          {
            taskId: 'task-4',
            stage: 'transform',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
          },
          {
            taskId: 'task-5',
            stage: 'vt',
            status: 'running',
            progress: 100,
            message: 'Cache saving',

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
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-3b' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-3b' as NodeId,
        tasks: [
          {
            taskId: 'task-3b',
            stage: 'fetch',
            status: 'recycled',
            progress: 100,
            message: 'recycled for retry',

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
        nodeId: 'node-3b' as NodeId,
        task: {
          taskId: 'task-3b',
          stage: 'fetch',
          status: 'running',
          progress: 100,
          message: 'still active'
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
    renderHook(() => useShapeBuildTaskSnapshotProgressState('node-4' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-4' as NodeId,
        task: {
          taskId: 'node-4:fetch:JPN:1',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done'
        },
      });
    });

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith('[TaskUpdate100] JPN, 1, Done, completed');
    });
  });

  it('does not log TaskUpdate100 for non-100 updates', async () => {
    renderHook(() => useShapeBuildTaskSnapshotProgressState('node-5' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-5' as NodeId,
        task: {
          taskId: 'node-5:fetch:JPN:1',
          stage: 'fetch',
          status: 'running',
          progress: 99,
          message: 'Working'
        },
      });
    });

    await waitFor(() => {
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[TaskUpdate100]'));
    });
  });

  it('ignores task events when nodeId does not match the active subscription', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-mismatch' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-other' as NodeId,
        task: {
          taskId: 'node-other:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'running'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(0);
    });
  });

  it('keeps terminal status when duplicate updates arrive', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-6' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6' as NodeId,
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'Queued'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('queued');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6' as NodeId,
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'running',
          progress: 50,
          message: 'Running'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6' as NodeId,
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'Late queued'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('running');
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-6' as NodeId,
        task: {
          taskId: 'node-6:fetch:BY:0',
          stage: 'fetch',
          status: 'completed',
          progress: 100,
          message: 'Done'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
    });
  });

  it('keeps existing tasks when a snapshot omits previously seen taskIds', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-7' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'snapshot',
        nodeId: 'node-7' as NodeId,
        tasks: [
          {
            taskId: 'node-7:fetch:ABW:0',
            stage: 'fetch',
            status: 'running',
            progress: 70,
            message: 'Running',

          },
          {
            taskId: 'node-7:fetch:ABW:1',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',

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
        nodeId: 'node-7'  as NodeId,
        tasks: [
          {
            taskId: 'node-7:fetch:ABW:1',
            stage: 'fetch',
            status: 'running',
            progress: 10,
            message: 'Start',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks[0]?.taskId).toBe('node-7:fetch:ABW:0');
      expect(result.current.tasks[1]?.taskId).toBe('node-7:fetch:ABW:1');
      expect(result.current.tasks[0]?.progress).toBe(70);
      expect(result.current.tasks[1]?.progress).toBe(10);
    });
  });

  it('ignores updates for different nodeId in active subscription', async () => {
    getBuildTasksMock.mockResolvedValue([]);
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-mismatch'  as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-other' as NodeId,
        task: {
          taskId: 'node-other:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 15,
          message: 'foreign'
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
      ({ nodeId }: { nodeId: string }) => useShapeBuildTaskSnapshotProgressState(nodeId as NodeId),
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
        nodeId: 'node-old' as NodeId,
        task: {
          taskId: 'node-old:fetch:JP:0',
          stage: 'fetch',
          status: 'running',
          progress: 20,
          message: 'stale'
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
        nodeId: 'node-new' as NodeId,
        task: {
          taskId: 'node-new:fetch:JP:0',
          stage: 'fetch',
          status: 'queued',
          progress: 0,
          message: 'queued'
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.taskId).toBe('node-new:fetch:JP:0');
    });
  });

  it('composes vt parent input summary metadata into task message', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-vt-meta' as NodeId));

    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    act(() => {
      subscriber?.({
        type: 'update',
        nodeId: 'node-vt-meta' as NodeId,
        task: {
          taskId: 'node-vt-meta:vt:2:6:123',
          stage: 'vt',
          status: 'running',
          progress: 30,
          message: 'tiles 12/40',
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
        message: 'Running'
      },
    ]);

    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-refresh-missing' as NodeId));

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
      const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-raf-fallback' as NodeId));

      await act(async () => {
        await Promise.resolve();
      });

      expect(subscribeMock).toHaveBeenCalled();

      act(() => {
        subscriber?.({
          type: 'update',
          nodeId: 'node-raf-fallback' as NodeId,
          task: {
            taskId: 'node-raf-fallback:fetch:JP:0',
            stage: 'fetch',
            status: 'queued',
            progress: 0,
            message: 'Queued',
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
