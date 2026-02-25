import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { resolveProgressValue } from './useShapeBuildTaskSync.comparison.utils.js';
import { resetTaskSyncDebugLogCounters } from './useShapeBuildTaskSync.debug.js';
import { useShapeBuildTaskSyncResolver } from './useShapeBuildTaskSync.resolver.js';
import type { RawTaskSummary, SyncArgs, SyncResult } from './useShapeBuildTaskSync.types.js';
import { useShapeBuildTaskSyncScheduling } from './useShapeBuildTaskSync.sync.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';

type CoreDeps = {
  sessionNodeId: SyncArgs['sessionNodeId'];
  markTaskSnapshotProgressSynchronized?: SyncArgs['markTaskSnapshotProgressSynchronized'];
  refs: HandlerRefs;
  setTasks: SyncArgs['setTasks'];
};

type CoreResult = {
  resolveTaskSummary: (task: RawTaskSummary) => ShapeBuildTaskSummary;
  bufferTaskUpdate: SyncResult['bufferTaskUpdate'];
  scheduleBufferedFlush: SyncResult['scheduleBufferedFlush'];
  scheduleFlush: SyncResult['scheduleFlush'];
  syncTasksRef: SyncResult['syncTasksRef'];
  syncLoadingRef: SyncResult['syncLoadingRef'];
  syncErrorRef: SyncResult['syncErrorRef'];
  resetPending: SyncResult['resetPending'];
  resetDebugCounters: () => void;
};

export const useShapeBuildTaskSyncCore = ({
  sessionNodeId,
  markTaskSnapshotProgressSynchronized,
  refs,
  setTasks,
}: CoreDeps): CoreResult => {
  const resolver = useShapeBuildTaskSyncResolver({
    sessionNodeId,
    refs: {
      completedTasksRef: refs.completedTasksRef,
      vtParentInputDebugLogKeysRef: refs.vtParentInputDebugLogKeysRef,
    },
    resolveProgressValue,
  });

  const scheduling = useShapeBuildTaskSyncScheduling({
    sessionNodeId,
    markTaskSnapshotProgressSynchronized,
    refs,
    setTasks,
  });

  return {
    resolveTaskSummary: resolver,
    bufferTaskUpdate: scheduling.bufferTaskUpdate,
    scheduleBufferedFlush: scheduling.scheduleBufferedFlush,
    scheduleFlush: scheduling.scheduleFlush,
    syncTasksRef: scheduling.syncTasksRef,
    syncLoadingRef: scheduling.syncLoadingRef,
    syncErrorRef: scheduling.syncErrorRef,
    resetPending: scheduling.resetPending,
    resetDebugCounters: resetTaskSyncDebugLogCounters,
  };
};
