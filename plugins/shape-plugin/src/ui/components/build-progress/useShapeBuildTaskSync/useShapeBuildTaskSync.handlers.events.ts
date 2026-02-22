import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { emitRunningResidueLog, logTaskUpdate100 } from './useShapeBuildTaskSync.debug.js';
import {
  areTasksEquivalentForView,
  isTerminalTask,
  isCompletedAtFullProgress,
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
  completedTasksRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  errorRef: MutableRefObject<Error | null>;
  isLoadingRef: MutableRefObject<boolean>;
  bufferedSnapshotRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedUpdatesRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  pendingTasksRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  committedTasksRef: MutableRefObject<ShapeBuildTaskSummary[]>;
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
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
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
  setTasks,
  setIsLoading,
  setError,
  markTaskStreamSynchronized,
}: EventHandlerDeps) => {
  const {
    tasksMapRef,
    completedTasksRef,
    errorRef,
    isLoadingRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    pendingTasksRef,
    committedTasksRef,
    isMountedRef,
    sessionNodeId,
  } = refs;

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = normalizeTaskSnapshot(next).map(resolveTaskSummary);
    bufferedSnapshotRef.current = snapshotTasks;
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
    completedTasksRef,
    tasksMapRef,
    errorRef,
    isLoadingRef,
    resolveTaskSummary,
    bufferTaskUpdate,
    scheduleBufferedFlush,
    onTaskTerminalProgressUpdate,
    sessionNodeId,
    setError,
    setIsLoading,
    markTaskStreamSynchronized,
  ]);

  const handleDelete = useCallback((taskId: string) => {
    const existing = tasksMapRef.current.get(taskId);
    if (!existing) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: null,
        taskId,
        prevStatus: null,
        nextStatus: null,
        source: 'event',
        eventType: 'delete',
        reason: 'task_not_found',
      });
      return;
    }
    emitRunningResidueLog('STATUS_TRANSITION', {
      nodeId: sessionNodeId,
      source: 'event',
      eventType: 'delete',
      taskId,
      stage: existing.stage,
      prevStatus: existing.status ?? null,
      nextStatus: 'deleted',
    });

    const nextMap = new Map(tasksMapRef.current);
    nextMap.delete(taskId);
    tasksMapRef.current = nextMap;

    const nextCompletedMap = new Map(completedTasksRef.current);
    nextCompletedMap.delete(taskId);
    completedTasksRef.current = nextCompletedMap;

    bufferedUpdatesRef.current.delete(taskId);
    if (bufferedSnapshotRef.current) {
      bufferedSnapshotRef.current = bufferedSnapshotRef.current.filter((item) => item.taskId !== taskId);
    }

    if (isCompletedAtFullProgress(existing)) {
      completedTasksRef.current.delete(taskId);
    }

    const current = pendingTasksRef.current ?? committedTasksRef.current;
    const next = current.filter((item) => item.taskId !== taskId);
    if (isMountedRef.current) {
      setTasks(next);
    }
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
    if (markTaskStreamSynchronized) {
      markTaskStreamSynchronized();
    }
  }, [
    completedTasksRef,
    errorRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    isMountedRef,
    isLoadingRef,
    pendingTasksRef,
    tasksMapRef,
    committedTasksRef,
    sessionNodeId,
    setTasks,
    setError,
    setIsLoading,
    markTaskStreamSynchronized,
  ]);

  return {
    handleSnapshot,
    handleUpdate,
    handleDelete,
  };
};
