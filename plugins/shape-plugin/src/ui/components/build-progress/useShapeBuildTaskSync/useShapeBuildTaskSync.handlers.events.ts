import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { emitRunningResidueLog, logTaskUpdate100 } from './useShapeBuildTaskSync.debug.js';
import {
  areTasksEquivalentForView,
  isTerminalTask,
  shouldPreferNextTask,
} from './useShapeBuildTaskSync.comparison.utils.js';

type EventHandlerRefs = {
  tasksMapRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  errorRef: MutableRefObject<Error | null>;
  isLoadingRef: MutableRefObject<boolean>;
  bufferedSnapshotRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedUpdatesRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
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
  markTaskSnapshotProgressSynchronized?: () => void;
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
  markTaskSnapshotProgressSynchronized,
}: EventHandlerDeps) => {
  const {
    tasksMapRef,
    errorRef,
    isLoadingRef,
    bufferedSnapshotRef,
    sessionNodeId,
  } = refs;
  const isDev = import.meta.env.DEV;

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = next.map((task) => resolveTaskSummary(task));
    for (const task of snapshotTasks) {
      const previous = tasksMapRef.current.get(task.taskId);
      if (!previous) {
        continue;
      }
      if (previous.stage !== task.stage) {
        const error = new Error(
          `[ShapeBuildTaskSync] task ${task.taskId} changed stage from ${previous.stage} to ${task.stage}`,
        );
        setError(error);
        throw error;
      }
    }
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
    sessionNodeId,
    onTaskSnapshot,
    resolveTaskSummary,
    scheduleBufferedFlush,
    setError,
    setIsLoading,
  ]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const previous = tasksMapRef.current.get(resolved.taskId);
    if (!previous && tasksMapRef.current.size > 0) {
      const message = `[ShapeBuildTaskSync] unknown taskId: ${resolved.taskId}`;
      if (isDev) {
        console.debug(`${message} (accepted as late update)`, {
          nodeId: sessionNodeId,
          task: resolved,
          currentTasks: Array.from(tasksMapRef.current.keys()),
        });
      }
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        prevStatus: null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
        reason: 'unknown_task_inserted',
      });
      bufferTaskUpdate(resolved);
      scheduleBufferedFlush();
      if (isLoadingRef.current) {
        setIsLoading(false);
      }
      if (sessionNodeId && markTaskSnapshotProgressSynchronized) {
        markTaskSnapshotProgressSynchronized();
      }
      return;
    }
    if (previous && previous.stage !== resolved.stage) {
      const message = `[ShapeBuildTaskSync] task ${resolved.taskId} changed stage from ${previous.stage} to ${resolved.stage}`;
      const error = new Error(message);
      setError(error);
      if (isDev) {
        console.error(message, {
          nodeId: sessionNodeId,
          previous,
          next: resolved,
        });
      }
      throw error;
    }
    if (previous && areTasksEquivalentForView(previous, resolved)) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
        reason: 'areTasksEquivalentForView=true',
      });
      return;
    }
    if (previous && !shouldPreferNextTask(previous, resolved)) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
        reason: 'shouldPreferNextTask=false',
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
    }
    logTaskUpdate100(resolved);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
    if (sessionNodeId && markTaskSnapshotProgressSynchronized) {
      markTaskSnapshotProgressSynchronized();
    }
  }, [
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
    markTaskSnapshotProgressSynchronized,
  ]);

  return {
    handleSnapshot,
    handleUpdate,
  };
};
