import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { useShapeBuildTaskSnapshotProgressState } from '../../../components/build-progress/useShapeBuildTaskSnapshotProgressState/useShapeBuildTaskSnapshotProgressState';
import { hasReceivingTaskSnapshotSignal } from '../../../components/build-progress/receivingTaskSnapshotSignal';

const hoistedMocks = vi.hoisted(() => ({
  initializeMock: vi.fn<[], Promise<void>>(),
  subscribeMock: vi.fn<
    [string, string, (event: BuildTaskUpdateEvent) => void],
    Promise<() => void>
  >(),
  getBuildTasksMock: vi.fn().mockResolvedValue([]),
}));
const initializeMock = hoistedMocks.initializeMock;
const subscribeMock = hoistedMocks.subscribeMock;
const getBuildTasksMock = hoistedMocks.getBuildTasksMock;
let subscriber: ((event: BuildTaskUpdateEvent) => void) | null = null;

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

describe('buildSessionStartup integration baseline', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    subscribeMock.mockClear();
    subscriber = null;
    initializeMock.mockResolvedValue(undefined);
  });

  it('observes queued receiving task snapshot signal with rAF fallback flush', async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7777);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useShapeBuildTaskSnapshotProgressState('node-integration'));
      expect(result.current.isTaskSnapshotProgressConnected).toBe(false);

      await act(async () => {
        await Promise.resolve();
      });
      expect(subscribeMock).toHaveBeenCalledTimes(1);

      act(() => {
        subscriber?.({
          type: 'update',
          nodeId: 'node-integration',
          task: {
            taskId: 'node-integration:fetch:JP:0',
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
      expect(result.current.isTaskSnapshotProgressConnected).toBe(true);

      const hasQueuedTasks = result.current.tasks.some((task) => task.status === 'queued');
      const hasStartedTasks = result.current.tasks.some((task) => (
        task.status === 'running'
        || task.status === 'completed'
        || task.status === 'recycled'
        || task.status === 'failed'
      ));
      expect(hasReceivingTaskSnapshotSignal({
        hasStartedTasks,
        hasQueuedTasks,
        progressTaskId: null,
        progressTotal: 0,
      })).toBe(true);
      expect(cancelSpy).toHaveBeenCalledWith(7777);
    } finally {
      rafSpy.mockRestore();
      cancelSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
