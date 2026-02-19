import { useShapeBuildTaskSyncCore } from './useShapeBuildTaskSync.core.js';
import { useShapeBuildTaskSyncEventHandlers } from './useShapeBuildTaskSync.handlers.events.js';
import type { RawTaskSummary, SyncArgs } from './useShapeBuildTaskSync.types.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';

type HandlerDeps = {
  sessionNodeId: SyncArgs['sessionNodeId'];
  markTaskStreamSynchronized?: SyncArgs['markTaskStreamSynchronized'];
  refs: HandlerRefs;
  setTasks: SyncArgs['setTasks'];
  setIsLoading: SyncArgs['setIsLoading'];
  setError: SyncArgs['setError'];
};

export const useShapeBuildTaskSyncHandlers = ({
  sessionNodeId,
  markTaskStreamSynchronized,
  refs,
  setTasks,
  setIsLoading,
  setError,
}: HandlerDeps) => {
  const {
    tasksRef,
    isLoadingRef,
    errorRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
    vtParentInputDebugLogKeysRef,
    pendingTasksRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    bufferedSequenceRef,
    committedSequenceRef,
    pendingDirtyRef,
    flushScheduledRef,
    flushFrameRef,
    flushTimeoutRef,
    isMountedRef,
  } = refs;

  const core = useShapeBuildTaskSyncCore({
    sessionNodeId,
    markTaskStreamSynchronized,
    refs: {
      tasksRef,
      isLoadingRef,
      errorRef,
      committedTasksRef,
      tasksMapRef,
      completedTasksRef,
      vtParentInputDebugLogKeysRef,
      pendingTasksRef,
      bufferedSnapshotRef,
      bufferedUpdatesRef,
      bufferedSequenceRef,
      committedSequenceRef,
      pendingDirtyRef,
      flushScheduledRef,
      flushFrameRef,
      flushTimeoutRef,
      isMountedRef,
    },
    setTasks,
  });

  const events = useShapeBuildTaskSyncEventHandlers({
    refs: {
      tasksMapRef,
      completedTasksRef,
      errorRef,
      isLoadingRef,
      bufferedSnapshotRef,
      bufferedUpdatesRef,
      bufferedSequenceRef,
      pendingTasksRef,
      committedTasksRef,
      committedSequenceRef,
      isMountedRef,
      sessionNodeId,
    },
    resolveTaskSummary: core.resolveTaskSummary,
    scheduleBufferedFlush: core.scheduleBufferedFlush,
    bufferTaskUpdate: core.bufferTaskUpdate,
    setTasks,
    setIsLoading,
    setError,
    markTaskStreamSynchronized,
  });

  const withTypes = <T extends Record<string, unknown>>(value: T) => value;

  return withTypes({
    handleSnapshot: (snapshot: RawTaskSummary[]) => events.handleSnapshot(snapshot),
    handleUpdate: (task: RawTaskSummary) => events.handleUpdate(task),
    handleDelete: (taskId: string) => events.handleDelete(taskId),
    syncTasksRef: core.syncTasksRef,
    syncLoadingRef: core.syncLoadingRef,
    syncErrorRef: core.syncErrorRef,
    resetPending: core.resetPending,
    scheduleFlush: core.scheduleFlush,
    resetDebugCounters: core.resetDebugCounters,
  });
};
