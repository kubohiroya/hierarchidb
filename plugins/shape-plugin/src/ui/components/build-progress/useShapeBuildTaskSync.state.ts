import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { isCompletedAtFullProgress } from './useShapeBuildTaskSync.comparison.utils.ts';
import type { HandlerRefs, SyncResult } from './useShapeBuildTaskSync.types.ts';

export type TaskSyncStateArgs = {
  refs: Pick<
    HandlerRefs,
    | 'tasksRef'
    | 'pendingTasksRef'
    | 'pendingDirtyRef'
    | 'flushScheduledRef'
    | 'bufferedSnapshotRef'
    | 'bufferedUpdatesRef'
    | 'bufferedSequenceRef'
    | 'flushFrameRef'
    | 'flushTimeoutRef'
    | 'committedTasksRef'
    | 'tasksMapRef'
    | 'completedTasksRef'
  >;
  updateCommittedSequences: (tasks: ShapeBuildTaskSummary[]) => void;
};

export const useShapeBuildTaskSyncState = ({
  refs,
  updateCommittedSequences,
}: TaskSyncStateArgs): Pick<SyncResult, 'syncTasksRef' | 'resetPending'> => {
  const {
    tasksRef,
    pendingTasksRef,
    pendingDirtyRef,
    flushScheduledRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    bufferedSequenceRef,
    flushFrameRef,
    flushTimeoutRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
  } = refs;

  const syncTasksRef = (tasks: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    flushScheduledRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();

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
    updateCommittedSequences(tasks);
  };

  const resetPending = () => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();
    flushScheduledRef.current = false;

    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  };

  return {
    syncTasksRef,
    resetPending,
  };
};
