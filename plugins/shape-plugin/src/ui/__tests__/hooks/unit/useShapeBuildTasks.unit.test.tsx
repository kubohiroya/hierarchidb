import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchTaskUpdateEvent } from '@hierarchidb/common-api';
import { useShapeBuildTasks } from '../../../components/step5/useShapeBuildTasks.ts';

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
        },
      });
    });

    await waitFor(() => {
      expect(result.current.tasks[0]?.status).toBe('completed');
    });

    expect(getBatchTasksMock).not.toHaveBeenCalled();
  });
});
