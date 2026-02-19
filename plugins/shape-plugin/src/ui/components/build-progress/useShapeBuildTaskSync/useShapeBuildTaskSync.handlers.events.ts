import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { emitRunningResidueLog, logTaskUpdate100 } from './useShapeBuildTaskSync.debug.js';
import {
  areTasksEquivalentForView,
  isCompletedAtFullProgress,
  shouldPreferNextTask,
} from './useShapeBuildTaskSync.comparison.utils.js';

type EventHandlerRefs = {
  tasksMapRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  completedTasksRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  errorRef: MutableRefObject<Error | null>;
  isLoadingRef: MutableRefObject<boolean>;
  bufferedSnapshotRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedUpdatesRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  bufferedSequenceRef: MutableRefObject<Map<string, number>>;
  pendingTasksRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  committedTasksRef: MutableRefObject<ShapeBuildTaskSummary[]>;
  committedSequenceRef: MutableRefObject<Map<string, number>>;
  isMountedRef: MutableRefObject<boolean>;
  sessionNodeId: string | null;
};

type EventHandlerDeps = {
  refs: EventHandlerRefs;
  resolveTaskSummary: (task: RawTaskSummary) => ShapeBuildTaskSummary;
  scheduleBufferedFlush: () => void;
  bufferTaskUpdate: (task: ShapeBuildTaskSummary) => void;
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  markTaskStreamSynchronized?: () => void;
};

export const useShapeBuildTaskSyncEventHandlers = ({
  refs,
  resolveTaskSummary,
  scheduleBufferedFlush,
  bufferTaskUpdate,
  setTasks,
  setIsLoading,
  setError,
  markTaskStreamSynchronized,
}: EventHandlerDeps) => {
  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = next.map(resolveTaskSummary);
    refs.bufferedSnapshotRef.current = snapshotTasks;
    scheduleBufferedFlush();
    if (refs.errorRef.current !== null) {
      setError(null);
    }
    if (refs.isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [
    refs.bufferedSnapshotRef,
    refs.errorRef,
    refs.isLoadingRef,
    resolveTaskSummary,
    scheduleBufferedFlush,
    setError,
    setIsLoading,
  ]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const previous = refs.tasksMapRef.current.get(resolved.taskId);
    const isEquivalent = previous ? areTasksEquivalentForView(previous, resolved) : false;
    const shouldPrefer = previous ? shouldPreferNextTask(previous, resolved) : true;
    if (previous && (isEquivalent || !shouldPrefer)) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: refs.sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        sequence: resolved.sequence ?? null,
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
        nodeId: refs.sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        sequence: resolved.sequence ?? null,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
      });
    }
    bufferTaskUpdate(resolved);
    scheduleBufferedFlush();
    logTaskUpdate100(resolved);
    if (refs.errorRef.current !== null) {
      setError(null);
    }
    if (refs.isLoadingRef.current) {
      setIsLoading(false);
    }
    if (refs.sessionNodeId && markTaskStreamSynchronized) {
      markTaskStreamSynchronized();
    }
  }, [
    refs,
    resolveTaskSummary,
    bufferTaskUpdate,
    scheduleBufferedFlush,
    setError,
    setIsLoading,
    markTaskStreamSynchronized,
  ]);

  const handleDelete = useCallback((taskId: string) => {
    const existing = refs.tasksMapRef.current.get(taskId);
    if (!existing) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: refs.sessionNodeId,
        stage: null,
        taskId,
        sequence: null,
        prevStatus: null,
        nextStatus: null,
        source: 'event',
        eventType: 'delete',
        reason: 'task_not_found',
      });
      return;
    }
    emitRunningResidueLog('STATUS_TRANSITION', {
      nodeId: refs.sessionNodeId,
      source: 'event',
      eventType: 'delete',
      taskId,
      stage: existing.stage,
      sequence: existing.sequence ?? null,
      prevStatus: existing.status ?? null,
      nextStatus: 'deleted',
    });
    const nextMap = new Map(refs.tasksMapRef.current);
    nextMap.delete(taskId);
    refs.tasksMapRef.current = nextMap;
    const nextCompletedMap = new Map(refs.completedTasksRef.current);
    nextCompletedMap.delete(taskId);
    refs.completedTasksRef.current = nextCompletedMap;
    const nextCommittedSequences = new Map(refs.committedSequenceRef.current);
    nextCommittedSequences.delete(taskId);
    refs.committedSequenceRef.current = nextCommittedSequences;
    refs.bufferedUpdatesRef.current.delete(taskId);
    refs.bufferedSequenceRef.current.delete(taskId);
    if (refs.bufferedSnapshotRef.current) {
      refs.bufferedSnapshotRef.current = refs.bufferedSnapshotRef.current.filter((task) => task.taskId !== taskId);
    }
    if (isCompletedAtFullProgress(existing)) {
      refs.completedTasksRef.current.delete(taskId);
    }
    const current = refs.pendingTasksRef.current ?? refs.committedTasksRef.current;
    const next = current.filter((task) => task.taskId !== taskId);
    if (refs.isMountedRef.current) {
      setTasks(next);
    }
    if (refs.errorRef.current !== null) {
      setError(null);
    }
    if (refs.isLoadingRef.current) {
      setIsLoading(false);
    }
    if (markTaskStreamSynchronized) {
      markTaskStreamSynchronized();
    }
  }, [
    refs,
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
