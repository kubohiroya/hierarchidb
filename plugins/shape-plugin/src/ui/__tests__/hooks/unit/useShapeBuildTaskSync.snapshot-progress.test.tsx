import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent, BuildTaskSummary, TaskStage } from '@hierarchidb/build-api';
import { useShapeBuildTaskSync } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync';
import { useShapeBuildTaskSnapshotProgressState } from '../../../components/build-progress/useShapeBuildTaskSnapshotProgressState/useShapeBuildTaskSnapshotProgressState';
import type { RawTaskSummary } from '../../../components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';
import type {ShapeBuildTaskSummary} from '@hierarchidb/shape-api';
import { NodeId } from "@hierarchidb/core-types";

type ShapeBuildTaskUpdateEvent = BuildTaskUpdateEvent<BuildTaskSummary & { stage: TaskStage }>;

type SubscriberRecord = {
  nodeId: string;
  callback: (event: ShapeBuildTaskUpdateEvent) => void;
  unsubscribed: boolean;
};

const hoistedMocks = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  subscribeMock: vi.fn(),
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

const emitEvent = (_nodeId: string, event: ShapeBuildTaskUpdateEvent) => {
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
  it('accepts empty snapshot without throwing and keeps current tasks', async () => {
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
      result.current.handleSnapshot([
        {
          taskId: 'node-running:fetch:1',
          stage: 'fetch',
          status: 'running',
          progress: 35,
          message: 'running',
          index: 1,
        } as RawTaskSummary,
      ]);
    });
    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
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
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(35);
    });
  });

  it('throws when snapshot changes stage for an existing taskId', async () => {
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
      result.current.handleSnapshot([
        {
          taskId: 'node-running:fetch:1',
          stage: 'fetch',
          status: 'running',
          progress: 10,
          message: 'running',
          index: 1,
        } as RawTaskSummary,
      ]);
    });
    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
    });

    act(() => {
      result.current.handleUpdate({
        taskId: 'node-running:fetch:1',
        stage: 'fetch',
        status: 'running',
        progress: 10,
        message: 'running',
        index: 1,
      } as RawTaskSummary);
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.stage).toBe('fetch');
    });

    expect(() => {
      act(() => {
        result.current.handleSnapshot([
          {
            taskId: 'node-running:fetch:1',
            stage: 'transform',
            status: 'running',
            progress: 15,
            message: 'moved',
            index: 1,
          } as RawTaskSummary,
        ]);
      });
    }).toThrow('changed stage');

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0]?.stage).toBe('fetch');
      expect(result.current.tasks[0]?.progress).toBe(10);
    });
  });

});

describe('useShapeBuildTaskSnapshotProgressState', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    getBuildTasksMock.mockReset();
    subscribers.splice(0, subscribers.length);
    initializeMock.mockResolvedValue(undefined);
    getBuildTasksMock.mockResolvedValue([]);
  });

  it('updates task state from initial snapshot and terminal-progress updates', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-progress' as NodeId));
    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    emitEvent('node-progress', {
      type: 'snapshot',
      nodeId: 'node-progress' as NodeId,
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
      nodeId: 'node-progress' as NodeId,
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

  it('accepts task updates for unknown taskId', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-progress' as NodeId));
    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    emitEvent('node-progress', {
      type: 'snapshot',
      nodeId: 'node-progress' as NodeId,
      tasks: [
        makeTaskSummary('node-progress:fetch:0', { status: 'running', progress: 20, index: 1 }),
        makeTaskSummary('node-progress:fetch:1', { status: 'running', progress: 10, index: 2 }),
      ],
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks[0]?.status).toBe('running');
      expect(result.current.tasks[0]?.progress).toBe(20);
    });

    emitEvent('node-progress', {
      type: 'update',
      nodeId: 'node-progress' as NodeId,
      task: makeTaskSummary('node-progress:fetch:unknown', {
        status: 'running',
        progress: 50,
        message: 'invalid',
        index: 0,
      }),
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(3);
    });
  });

  it('keeps update target semantics for known tasks', async () => {
    const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-progress' as NodeId));
    await waitFor(() => {
      expect(subscribeMock).toHaveBeenCalled();
    });

    emitEvent('node-progress', {
      type: 'snapshot',
      nodeId: 'node-progress' as NodeId,
      tasks: [
        makeTaskSummary('node-progress:transform:0', { stage: 'transform', status: 'running', progress: 20, index: 1 }),
        makeTaskSummary('node-progress:transform:1', { stage: 'transform', status: 'queued', progress: 0, index: 2 }),
        makeTaskSummary('node-progress:transform:2', { stage: 'transform', status: 'queued', progress: 0, index: 3 }),
        makeTaskSummary('node-progress:transform:3', { stage: 'transform', status: 'queued', progress: 0, index: 4 }),
      ],
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(4);
      expect(result.current.tasks[0]?.taskId).toContain('transform:0');
    });

    emitEvent('node-progress', {
      type: 'update',
      nodeId: 'node-progress' as NodeId,
      task: makeTaskSummary('node-progress:transform:0', {
        status: 'running',
        progress: 45,
        index: 1,
        stage: 'transform',
      }),
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(4);
      expect(result.current.tasks.find((task) => task.taskId === 'node-progress:transform:0')?.progress).toBe(45);
    });
  });
});
