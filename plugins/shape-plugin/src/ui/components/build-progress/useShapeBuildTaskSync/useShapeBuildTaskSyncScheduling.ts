import { useCallback } from 'react';
import {
  areTaskListsEquivalentForView,
  isCompletedAtFullProgress,
  replaceSnapshotAndPreserveNonIncomingStages,
} from './useShapeBuildTaskSync.comparison.utils.js';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { upsertTaskInOrder } from '@hierarchidb/ui-build-sessions';
import { useShapeBuildTaskSyncState } from './useShapeBuildTaskSyncState.js';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import type { SyncResult, SyncSchedulingArgs } from './useShapeBuildTaskSync.types.js';

const TASK_FLUSH_FALLBACK_TIMEOUT_MS = 120;

export const useShapeBuildTaskSyncScheduling = ({
  sessionNodeId,
  markTaskSnapshotProgressSynchronized,
  refs,
  setTasks,
}: SyncSchedulingArgs): SyncResult => {
  void sessionNodeId;
  const {
    tasksRef,
    isLoadingRef,
    errorRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
    pendingTasksRef,
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    pendingDirtyRef,
    flushScheduledRef,
    flushFrameRef,
    flushTimeoutRef,
    isMountedRef,
  } = refs;

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[], dirty: boolean) => {
    if (!dirty) {
      markTaskSnapshotProgressSynchronized?.();
      return;
    }
    committedTasksRef.current = next;
    const shouldUpdateTasks = next.length === 0 || !areTaskListsEquivalentForView(tasksRef.current, next);
    if (!isMountedRef.current) {
      markTaskSnapshotProgressSynchronized?.();
      return;
    }
    if (shouldUpdateTasks) {
      setTasks(next);
    }
    markTaskSnapshotProgressSynchronized?.();
    }, [committedTasksRef, isMountedRef, markTaskSnapshotProgressSynchronized, setTasks, tasksRef]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[], dirty = true) => {
    if (!isMountedRef.current) return;
    const pendingCurrent = pendingTasksRef.current;
    if (pendingCurrent && areTaskListsEquivalentForView(pendingCurrent, next)) {
      pendingDirtyRef.current = pendingDirtyRef.current || dirty;
      return;
    }
    pendingTasksRef.current = next;
    pendingDirtyRef.current = pendingDirtyRef.current || dirty;
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    const flushPending = () => {
      if (!flushScheduledRef.current) return;
      flushScheduledRef.current = false;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      const pending = pendingTasksRef.current;
      const isDirty = pendingDirtyRef.current;
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      if (pending) {
        flushTasks(pending, isDirty);
      }
    };
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null;
      flushPending();
    });
    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushPending();
    }, TASK_FLUSH_FALLBACK_TIMEOUT_MS);
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flushPending);
    }
  }, [
    flushScheduledRef,
    flushFrameRef,
    flushTimeoutRef,
    isMountedRef,
    pendingTasksRef,
    pendingDirtyRef,
    flushTasks,
  ]);

  const mergeTaskWithBase = useCallback((
    task: ShapeBuildTaskSummary,
    baseList: ShapeBuildTaskSummary[],
  ) => {
    const taskMetadataMessage = resolveTaskMetadataMessage(task.metadata)?.trim() ?? '';
    const nextMap = new Map(tasksMapRef.current);
    const currentTask = nextMap.get(task.taskId);
    if (!currentTask) {
      const nextList = upsertTaskInOrder(baseList, task);
      nextMap.set(task.taskId, task);
      if (isCompletedAtFullProgress(task)) {
        const nextCompletedMap = new Map(completedTasksRef.current);
        nextCompletedMap.set(task.taskId, task);
        completedTasksRef.current = nextCompletedMap;
      }
      return { next: nextList, changed: true } as const;
    }
    if (currentTask.status === task.status
      && currentTask.progress === task.progress
      && (resolveTaskMetadataMessage(currentTask.metadata) ?? '') === taskMetadataMessage) {
      return { next: baseList, changed: false } as const;
    }
    const nextList = [...baseList];
    const taskIndex = nextList.findIndex((entry) => entry.taskId === task.taskId);
    if (taskIndex >= 0) {
      nextList[taskIndex] = task;
    } else {
      nextList.push(task);
    }
    nextMap.set(task.taskId, task);
    if (isCompletedAtFullProgress(task)) {
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextCompletedMap.set(task.taskId, task);
      completedTasksRef.current = nextCompletedMap;
    } else if (isCompletedAtFullProgress(currentTask)) {
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextCompletedMap.delete(task.taskId);
      completedTasksRef.current = nextCompletedMap;
    }
    return { next: upsertTaskInOrder(nextList, task), changed: true } as const;
  }, [completedTasksRef, tasksMapRef]);

  const bufferTaskUpdate = useCallback((task: ShapeBuildTaskSummary) => {
    bufferedUpdatesRef.current.set(task.taskId, task);
  }, [bufferedUpdatesRef]);

  const applyBufferedEvents = useCallback(() => {
    const bufferedSnapshot = bufferedSnapshotRef.current;
    const bufferedUpdates = bufferedUpdatesRef.current;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();

    let nextList = bufferedSnapshot
      ? replaceSnapshotAndPreserveNonIncomingStages(bufferedSnapshot, tasksMapRef.current)
      : (pendingTasksRef.current ?? committedTasksRef.current);
    let changed = bufferedSnapshot !== null;

    if (bufferedSnapshot) {
      tasksMapRef.current = new Map(nextList.map((task: ShapeBuildTaskSummary) => [task.taskId, task]));
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextList.forEach((task: ShapeBuildTaskSummary) => {
        if (isCompletedAtFullProgress(task)) {
          nextCompletedMap.set(task.taskId, task);
        }
      });
      completedTasksRef.current = nextCompletedMap;
    }

    bufferedUpdates.forEach((task: ShapeBuildTaskSummary) => {
      const result = mergeTaskWithBase(task, nextList);
      nextList = result.next;
      changed = changed || result.changed;
    });

    return { nextList, changed };
  }, [
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    pendingTasksRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
    mergeTaskWithBase,
  ]);

  const scheduleBufferedFlush = useCallback(() => {
    if (!isMountedRef.current || flushScheduledRef.current) {
      return;
    }
    flushScheduledRef.current = true;
    const flushPending = () => {
      if (!flushScheduledRef.current) return;
      flushScheduledRef.current = false;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      const { nextList, changed } = applyBufferedEvents();
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      flushTasks(nextList, changed);
    };
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null;
      flushPending();
    });
    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushPending();
    }, TASK_FLUSH_FALLBACK_TIMEOUT_MS);
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flushPending);
    }
  }, [
    flushScheduledRef,
    isMountedRef,
    flushFrameRef,
    flushTimeoutRef,
    applyBufferedEvents,
    pendingTasksRef,
    pendingDirtyRef,
    flushTasks,
  ]);

  const { syncTasksRef, resetPending } = useShapeBuildTaskSyncState({
    refs: {
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
    },
  });

  return {
    bufferTaskUpdate,
    scheduleBufferedFlush,
    scheduleFlush,
    syncTasksRef,
    syncLoadingRef: useCallback((loading: boolean) => {
      isLoadingRef.current = loading;
    }, [isLoadingRef]),
    syncErrorRef: useCallback((error: Error | null) => {
      errorRef.current = error;
    }, [errorRef]),
    resetPending,
  };
};
