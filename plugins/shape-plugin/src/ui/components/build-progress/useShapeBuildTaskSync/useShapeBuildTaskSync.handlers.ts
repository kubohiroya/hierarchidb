import { useShapeBuildTaskSyncCore } from './useShapeBuildTaskSync.core.js';
import { useShapeBuildTaskSyncEventHandlers } from './useShapeBuildTaskSync.handlers.events.js';
import { useMemo } from 'react';
import type { RawTaskSummary, SyncArgs } from './useShapeBuildTaskSync.types.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';

type HandlerDeps = {
  sessionNodeId: SyncArgs['sessionNodeId'];
  markTaskStreamSynchronized?: SyncArgs['markTaskStreamSynchronized'];
  onTaskSnapshot?: SyncArgs['onTaskSnapshot'];
  onTaskTerminalProgressUpdate?: SyncArgs['onTaskTerminalProgressUpdate'];
  refs: HandlerRefs;
  setTasks: SyncArgs['setTasks'];
  setIsLoading: SyncArgs['setIsLoading'];
  setError: SyncArgs['setError'];
};

export const useShapeBuildTaskSyncHandlers = ({
  sessionNodeId,
  markTaskStreamSynchronized,
  onTaskSnapshot,
  onTaskTerminalProgressUpdate,
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
      errorRef,
      isLoadingRef,
      bufferedSnapshotRef,
      bufferedUpdatesRef,
      sessionNodeId,
    },
    resolveTaskSummary: core.resolveTaskSummary,
    scheduleBufferedFlush: core.scheduleBufferedFlush,
    bufferTaskUpdate: core.bufferTaskUpdate,
    onTaskSnapshot,
    onTaskTerminalProgressUpdate,
    setIsLoading,
    setError,
    markTaskStreamSynchronized,
  });

  const handleSnapshot = useMemo(() => {
    return (snapshot: unknown) => events.handleSnapshot(snapshot as RawTaskSummary[]);
  }, [events.handleSnapshot]);

  return useMemo(() => ({
    handleSnapshot,
    handleUpdate: (task: RawTaskSummary) => events.handleUpdate(task),
    syncTasksRef: core.syncTasksRef,
    syncLoadingRef: core.syncLoadingRef,
    syncErrorRef: core.syncErrorRef,
    resetPending: core.resetPending,
    scheduleFlush: core.scheduleFlush,
    resetDebugCounters: core.resetDebugCounters,
  }), [
    core.syncTasksRef,
    core.syncLoadingRef,
    core.syncErrorRef,
    core.resetPending,
    core.scheduleFlush,
    core.resetDebugCounters,
    events.handleUpdate,
    handleSnapshot,
  ]);
};
