import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { useCallback } from 'react';
import { isCompletedAtFullProgress } from './useShapeBuildTaskSync.comparisonUtils.js';
import type { HandlerRefs, SyncResult } from './useShapeBuildTaskSyncTypes.js';

export type TaskSyncStateArgs = {
  refs: Pick<
    HandlerRefs,
    | 'tasksRef'
    | 'pendingTasksRef'
    | 'pendingDirtyRef'
    | 'flushScheduledRef'
    | 'bufferedSnapshotRef'
    | 'bufferedUpdatesRef'
    | 'flushFrameRef'
    | 'flushTimeoutRef'
    | 'committedTasksRef'
    | 'tasksMapRef'
    | 'completedTasksRef'
  >;
};

export const useShapeBuildTaskSyncState = ({
  refs,
}: TaskSyncStateArgs): Pick<SyncResult, 'syncTasksRef' | 'resetPending'> => {
  const {
    tasksRef,
    pendingTasksRef,
    pendingDirtyRef,
    flushScheduledRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    flushFrameRef,
    flushTimeoutRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
  } = refs;

  const syncTasksRef = useCallback((tasks: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    flushScheduledRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();

    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    tasksRef.current = tasks;
    committedTasksRef.current = tasks;
    tasksMapRef.current = new Map(tasks.map((task) => [task.taskId, task]));
    completedTasksRef.current = new Map(
      tasks
        .filter((task) => isCompletedAtFullProgress(task))
        .map((task) => [task.taskId, task]),
    );
  }, [
    pendingTasksRef,
    pendingDirtyRef,
    flushScheduledRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    flushFrameRef,
    flushTimeoutRef,
    tasksRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
  ]);

  const resetPending = useCallback(() => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    flushScheduledRef.current = false;

    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, [
    pendingTasksRef,
    pendingDirtyRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    flushScheduledRef,
    flushFrameRef,
    flushTimeoutRef,
  ]);

  return {
    syncTasksRef,
    resetPending,
  };
};
