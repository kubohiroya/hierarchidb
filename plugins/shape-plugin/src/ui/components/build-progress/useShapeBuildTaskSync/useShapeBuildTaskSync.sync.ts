import { useCallback } from 'react';
import { buildTaskSequenceMap, readTaskSequence, upsertTaskInOrder } from '@hierarchidb/ui-batch-progress';
import { emitRunningResidueLog } from './useShapeBuildTaskSync.debug.js';
import {
  areTaskListsEquivalentForView,
  areTasksEquivalentForView,
  isCompletedAtFullProgress,
  mergeSnapshotWithCurrent,
  shouldPreferNextTask,
} from './useShapeBuildTaskSync.comparison.utils.js';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildTaskSyncState } from './useShapeBuildTaskSync.state.js';
import type { SyncResult, SyncSchedulingArgs } from './useShapeBuildTaskSync.types.js';

const TASK_FLUSH_FALLBACK_TIMEOUT_MS = 120;

export const useShapeBuildTaskSyncScheduling = ({
  sessionNodeId,
  markTaskStreamSynchronized,
  refs,
  setTasks,
}: SyncSchedulingArgs): SyncResult => {
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
    bufferedSequenceRef,
    committedSequenceRef,
    pendingDirtyRef,
    flushScheduledRef,
    flushFrameRef,
    flushTimeoutRef,
    isMountedRef,
  } = refs;

  const updateCommittedSequences = useCallback((tasks: ShapeBuildTaskSummary[]) => {
    committedSequenceRef.current = buildTaskSequenceMap(tasks);
  }, [committedSequenceRef]);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[], dirty: boolean) => {
    if (!dirty) {
      markTaskStreamSynchronized?.();
      return;
    }
    if (areTaskListsEquivalentForView(committedTasksRef.current, next)) {
      committedTasksRef.current = next;
      updateCommittedSequences(next);
      markTaskStreamSynchronized?.();
      return;
    }
    committedTasksRef.current = next;
    updateCommittedSequences(next);
    if (!isMountedRef.current) {
      markTaskStreamSynchronized?.();
      return;
    }
    setTasks(next);
    markTaskStreamSynchronized?.();
  }, [committedTasksRef, isMountedRef, markTaskStreamSynchronized, setTasks, updateCommittedSequences]);

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
    const currentTask = tasksMapRef.current.get(task.taskId);
    if (currentTask && areTasksEquivalentForView(currentTask, task)) {
      return { next: baseList, changed: false } as const;
    }
    if (currentTask && !shouldPreferNextTask(currentTask, task)) {
      return { next: baseList, changed: false } as const;
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.set(task.taskId, task);
    tasksMapRef.current = nextMap;
    if (isCompletedAtFullProgress(task)) {
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextCompletedMap.set(task.taskId, task);
      completedTasksRef.current = nextCompletedMap;
    }
    return { next: upsertTaskInOrder(baseList, task), changed: true } as const;
  }, [completedTasksRef, tasksMapRef]);

  const bufferTaskUpdate = useCallback((task: ShapeBuildTaskSummary) => {
    const nextSequence = readTaskSequence(task);
    const committedSequence = nextSequence === null ? undefined : committedSequenceRef.current.get(task.taskId);
    if (nextSequence !== null && committedSequence !== undefined && nextSequence < committedSequence) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: task.stage,
        taskId: task.taskId,
        sequence: nextSequence,
        prevStatus: null,
        nextStatus: task.status ?? null,
        source: 'buffer',
        eventType: 'update',
        reason: 'sequence_older_than_committed',
      });
      return;
    }
    const bufferedSequence = bufferedSequenceRef.current.get(task.taskId);
    if (nextSequence !== null && bufferedSequence !== undefined && nextSequence <= bufferedSequence) {
      return;
    }
    bufferedUpdatesRef.current.set(task.taskId, task);
    if (nextSequence !== null) {
      bufferedSequenceRef.current.set(task.taskId, nextSequence);
    }
  }, [bufferedSequenceRef, bufferedUpdatesRef, committedSequenceRef, sessionNodeId]);

  const applyBufferedEvents = useCallback(() => {
    const bufferedSnapshot = bufferedSnapshotRef.current;
    const bufferedUpdates = bufferedUpdatesRef.current;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();

    let nextList = bufferedSnapshot
      ? mergeSnapshotWithCurrent(bufferedSnapshot, tasksMapRef.current)
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
      updateCommittedSequences(nextList);
    }

    bufferedUpdates.forEach((task: ShapeBuildTaskSummary) => {
      const nextSequence = readTaskSequence(task);
      const committedSequence = nextSequence === null ? undefined : committedSequenceRef.current.get(task.taskId);
      if (nextSequence !== null && committedSequence !== undefined && nextSequence < committedSequence) {
        return;
      }
      const result = mergeTaskWithBase(task, nextList);
      nextList = result.next;
      changed = changed || result.changed;
      if (nextSequence !== null) {
        committedSequenceRef.current.set(task.taskId, nextSequence);
      }
    });

    return { nextList, changed };
  }, [
    bufferedSnapshotRef,
    bufferedUpdatesRef,
    bufferedSequenceRef,
    pendingTasksRef,
    committedTasksRef,
    tasksMapRef,
    completedTasksRef,
    committedSequenceRef,
    updateCommittedSequences,
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
      bufferedSequenceRef,
      flushFrameRef,
      flushTimeoutRef,
      committedTasksRef,
      tasksMapRef,
      completedTasksRef,
    },
    updateCommittedSequences,
  });

  return {
    bufferTaskUpdate,
    scheduleBufferedFlush,
    scheduleFlush,
    syncTasksRef,
    syncLoadingRef: (loading: boolean) => {
      isLoadingRef.current = loading;
    },
    syncErrorRef: (error: Error | null) => {
      errorRef.current = error;
    },
    resetPending,
  };
};
