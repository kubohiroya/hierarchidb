import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchTaskUpdateEvent } from '@hierarchidb/batch-api';
import { useShapeBuildTasks } from '../../../components/build-progress/useShapeBuildTasks.ts';

const initializeMock = vi.fn<[], Promise<void>>();
const subscribeMock = vi.fn<[
  string,
  string,
  (event: BatchTaskUpdateEvent) => void
], Promise<() => void>>();
const getBatchTasksMock = vi.fn();
let subscriber: ((event: BatchTaskUpdateEvent) => void) | null = null;

vi.mock('@hierarchidb/ui-worker-client', () => ({
  getWorkerBridge: () => ({
    initialize: initializeMock,
    subscribeBatchTasks: subscribeMock.mockImplementation(async (_nodeType, _nodeId, cb) => {
      subscriber = cb;
      return () => {
        subscriber = null;
      };
    }),
    getBatchTasks: getBatchTasksMock,
  }),
}));

describe('useShapeBuildTasks', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    getBatchTasksMock.mockReset();
    subscriber = null;
    initializeMock.mockResolvedValue(undefined);
  });

  it('applies snapshot and update events without polling', async () => {
    const { result } = renderHook(() => useShapeBuildTasks('node-1'));

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
            sequence: 1,
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
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
          sequence: 2,
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
          sequence: 1,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
    });

    expect(getBatchTasksMock).not.toHaveBeenCalled();
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
            sequence: 1,
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
          sequence: 2,
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
          sequence: 3,
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
      expect(result.current.tasks[0]?.progress).toBe(100);
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
            sequence: 1,
          },
          {
            taskId: 'task-4',
            stage: 'transform',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 2,
            sequence: 1,
          },
          {
            taskId: 'task-5',
            stage: 'vt',
            status: 'running',
            progress: 100,
            message: 'Cache saving',
            index: 3,
            sequence: 1,
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
});
