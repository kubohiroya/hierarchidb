import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { emitRunningResidueLog, logTaskUpdate100 } from './useShapeBuildTaskSync.debug.js';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

import {
  areTasksEquivalentForView,
  isTerminalTask,
  shouldPreferNextTask,
} from './useShapeBuildTaskSync.comparison.utils.js';

const normalizeTaskSnapshot = (tasks: unknown): RawTaskSummary[] => {
  if (!Array.isArray(tasks)) {
    return [];
  }
  const snapshot: RawTaskSummary[] = [];
  for (const task of tasks) {
    if (task && typeof task === 'object') {
      snapshot.push(task as RawTaskSummary);
    }
  }
  return snapshot;
};

type EventHandlerRefs = {
  tasksMapRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  errorRef: MutableRefObject<Error | null>;
  isLoadingRef: MutableRefObject<boolean>;
  bufferedSnapshotRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedUpdatesRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  isMountedRef: MutableRefObject<boolean>;
  sessionNodeId: string | null;
};

type EventHandlerDeps = {
  refs: EventHandlerRefs;
  resolveTaskSummary: (task: RawTaskSummary) => ShapeBuildTaskSummary;
  scheduleBufferedFlush: () => void;
  bufferTaskUpdate: (task: ShapeBuildTaskSummary) => void;
  onTaskSnapshot?: (tasks: ShapeBuildTaskSummary[]) => void;
  onTaskTerminalProgressUpdate?: (task: ShapeBuildTaskSummary) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  markTaskStreamSynchronized?: () => void;
};

const isTerminalTaskLike = (task: ShapeBuildTaskSummary): boolean => (
  isTerminalTask(task)
);

export const useShapeBuildTaskSyncEventHandlers = ({
  refs,
  resolveTaskSummary,
  scheduleBufferedFlush,
  bufferTaskUpdate,
  onTaskSnapshot,
  onTaskTerminalProgressUpdate,
  setIsLoading,
  setError,
  markTaskStreamSynchronized,
}: EventHandlerDeps) => {
  const {
    tasksMapRef,
    errorRef,
    isLoadingRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    sessionNodeId,
  } = refs;

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = normalizeTaskSnapshot(next).map(resolveTaskSummary);
    bufferedSnapshotRef.current = snapshotTasks;
    bufferedUpdatesRef.current = new Map();
    onTaskSnapshot?.(snapshotTasks);
    scheduleBufferedFlush();
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [
    bufferedSnapshotRef,
    errorRef,
    isLoadingRef,
    onTaskSnapshot,
    resolveTaskSummary,
    scheduleBufferedFlush,
    setError,
    setIsLoading,
  ]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const previous = tasksMapRef.current.get(resolved.taskId);
    const isEquivalent = previous ? areTasksEquivalentForView(previous, resolved) : false;
    const shouldPrefer = previous ? shouldPreferNextTask(previous, resolved) : true;
    if (previous && (isEquivalent || !shouldPrefer)) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
        reason: 'shouldPreferNextTask=false_or_equivalent',
      });
      return;
    }
    if (previous && previous.status !== resolved.status) {
      emitRunningResidueLog('STATUS_TRANSITION', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
      });
    }
    bufferTaskUpdate(resolved);
    scheduleBufferedFlush();
    if (isTerminalTaskLike(resolved) || resolved.progress >= 100) {
      onTaskTerminalProgressUpdate?.(resolved);
      logTaskUpdate100(resolved);
    } else {
      logTaskUpdate100(resolved);
    }
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
    if (sessionNodeId && markTaskStreamSynchronized) {
      markTaskStreamSynchronized();
    }
  }, [
    tasksMapRef,
    errorRef,
    isLoadingRef,
    bufferTaskUpdate,
    sessionNodeId,
    resolveTaskSummary,
    scheduleBufferedFlush,
    onTaskTerminalProgressUpdate,
    setError,
    setIsLoading,
    markTaskStreamSynchronized,
  ]);

  return {
    handleSnapshot,
    handleUpdate,
  };
};
