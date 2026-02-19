import { useEffect, useRef } from 'react';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import type { SyncArgs } from './useShapeBuildTaskSync.types.js';
import { useShapeBuildTaskSyncHandlers } from './useShapeBuildTaskSync.handlers.js';

export const useShapeBuildTaskSync = ({
  sessionNodeId,
  setTasks,
  setIsLoading,
  setError,
  markTaskStreamSynchronized,
}: SyncArgs) => {
  const isLoadingRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const tasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const committedTasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const tasksMapRef = useRef(new Map<string, ShapeBuildTaskSummary>());
  const completedTasksRef = useRef(new Map<string, ShapeBuildTaskSummary>());
  const vtParentInputDebugLogKeysRef = useRef(new Set<string>());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const bufferedSnapshotRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const bufferedUpdatesRef = useRef(new Map<string, ShapeBuildTaskSummary>());
  const bufferedSequenceRef = useRef(new Map<string, number>());
  const committedSequenceRef = useRef(new Map<string, number>());
  const pendingDirtyRef = useRef(false);
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const handlers = useShapeBuildTaskSyncHandlers({
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
    setIsLoading,
    setError,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      handlers.syncTasksRef([]);
      handlers.resetPending();
      vtParentInputDebugLogKeysRef.current.clear();
    };
  }, [handlers, flushFrameRef, flushTimeoutRef]);

  useEffect(() => {
    vtParentInputDebugLogKeysRef.current.clear();
    handlers.resetDebugCounters();
    handlers.syncTasksRef([]);
    handlers.resetPending();
  }, [sessionNodeId, handlers]);

  useEffect(() => () => {
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, [flushFrameRef, flushTimeoutRef]);

  return {
    tasksRef,
    isLoadingRef,
    errorRef,
    handleSnapshot: handlers.handleSnapshot,
    handleUpdate: handlers.handleUpdate,
    handleDelete: handlers.handleDelete,
    syncTasksRef: handlers.syncTasksRef,
    syncLoadingRef: handlers.syncLoadingRef,
    syncErrorRef: handlers.syncErrorRef,
    resetPending: handlers.resetPending,
    scheduleFlush: handlers.scheduleFlush,
  };
};
