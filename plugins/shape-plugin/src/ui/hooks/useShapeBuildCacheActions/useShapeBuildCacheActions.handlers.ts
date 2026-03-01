import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import type { NodeId } from '@hierarchidb/core-types';
import { notify } from '@hierarchidb/components';
import { deleteTasksByNode, VtTaskQueueDb as TileEmitTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { deleteSourceRawCache } from './useShapeBuildCacheActions.helpers.js';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

type BuildTaskFilterDeps = {
  nodeId?: NodeId;
  setBuildTasks: (
    updater: ShapeBuildTaskSummary[] | ((prev: ShapeBuildTaskSummary[]) => ShapeBuildTaskSummary[]),
  ) => void;
  setPersistedTasks: (
    updater: ShapeBuildTaskSummary[] | ((prev: ShapeBuildTaskSummary[]) => ShapeBuildTaskSummary[]),
  ) => void;
};

type FilterContext = BuildTaskFilterDeps & {
  runClearTaskQueueStages: (taskTypes: BuildTaskType[]) => Promise<void>;
};

export type CacheActionKey = 'sourceApi' | 'sourceFiltered' | 'geometry' | 'tileEmit' | 'transposeIndex' | 'metadata' | 'resetSession';

type ActionDeps = BuildTaskFilterDeps & {
  sessionStatus: BuildSessionStatus['status'] | null;
  runDelete: (key: CacheActionKey, action: () => Promise<void>) => Promise<void>;
  loadCountsSafely: () => Promise<void>;
  hasPersistedOutputs: () => Promise<boolean>;
  hasRunningBuildSession: () => Promise<boolean>;
  onResetSession?: () => void;
  persistSessionReset: () => Promise<void>;
  runClearTaskQueueStages: (taskTypes: BuildTaskType[]) => Promise<void>;
};

const filterByStage = (deps: FilterContext, taskTypes: BuildTaskType[]) => {
  const clearFromMemory = async () => {
    const keep = (task: ShapeBuildTaskSummary): boolean => {
      return !taskTypes.includes(task.stage);
    };
    await Promise.all([
      deps.setBuildTasks((prev) => prev.filter(keep)),
      deps.setPersistedTasks((prev) => prev.filter(keep)),
    ]);
  };

  return clearFromMemory();
};

const clearSessionQueueIfNeeded = async (deps: ActionDeps, skipIfRunning = false): Promise<boolean> => {
  if (!deps.sessionStatus || deps.sessionStatus === 'completed') return false;

  const running = await deps.hasRunningBuildSession();
  if (running) {
    return false;
  }
  if (skipIfRunning) {
    return false;
  }
  if (deps.sessionStatus !== 'running') {
    return false;
  }
  deps.onResetSession?.();
  await deps.persistSessionReset();
  return true;
};

const clearMetadataAndTaskStates = async (deps: ActionDeps, taskTypes: BuildTaskType[]): Promise<void> => {
  await deps.runClearTaskQueueStages(taskTypes);
  await filterByStage(deps, taskTypes);
};

const handleDeleteTileEmitArtifacts = async (deps: ActionDeps, successMessage: string): Promise<void> => {
  const nodeId = deps.nodeId;
  if (!nodeId) return;
  const taskTypes: BuildTaskType[] = ['tileEmit'];
  const taskQueue = new TileEmitTaskQueueDb();
  await ephemeralShapeAPIImpl.clearStage(nodeId, 'tileEmit');
  await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
  await clearMetadataAndTaskStates(deps, taskTypes);
  await taskQueue.tasks.where('nodeId').equals(nodeId).delete();
  const shouldPreserveSession = deps.sessionStatus === 'completed' || (await deps.hasPersistedOutputs());
  const resetByStale = await clearSessionQueueIfNeeded(deps);
  if (!shouldPreserveSession && !resetByStale) {
    deps.onResetSession?.();
    await deps.persistSessionReset();
  }
  await deps.loadCountsSafely();
  notify.success(successMessage);
};

export const handleDeleteSourceApiCache = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  const nodeId = deps.nodeId;
  const taskTypes: BuildTaskType[] = ['source', 'geometry', 'tileEmit'];
  await deps.runDelete('sourceApi', async () => {
    let deletedApiCache = false;
    try {
      await deleteSourceRawCache(nodeId);
      deletedApiCache = true;
    } catch (error) {
      console.warn('[shapeBuildCache] failed to delete source API cache', error);
      notify.error('Failed to delete API cache.');
    }

    try {
      await clearMetadataAndTaskStates(deps, taskTypes);
    } catch (error) {
      console.warn('[shapeBuildCache] failed to clear build task metadata', error);
      notify.error('Failed to remove API cache related task data.');
    }

    await clearSessionQueueIfNeeded(deps);
    await deps.loadCountsSafely();
    if (deletedApiCache) {
      notify.success('Deleted API cache');
    }
  });
};

export const handleDeleteSourceFilteredCache = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  const nodeId = deps.nodeId;
  const taskTypes: BuildTaskType[] = ['source', 'geometry', 'tileEmit'];
  await deps.runDelete('sourceFiltered', async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'source');
    await clearMetadataAndTaskStates(deps, taskTypes);

    const shouldPreserveSession = deps.sessionStatus === 'completed' || (await deps.hasPersistedOutputs());
    const resetByStale = await clearSessionQueueIfNeeded(deps);
    if (!shouldPreserveSession && !resetByStale) {
      deps.onResetSession?.();
      await deps.persistSessionReset();
    }

    await deps.loadCountsSafely();
    notify.success('Deleted source filtered cache');
  });
};

export const handleDeleteGeometryCache = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  const nodeId = deps.nodeId;
  const taskTypes: BuildTaskType[] = ['geometry', 'tileEmit'];
  await deps.runDelete('geometry', async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'geometry');
    await clearMetadataAndTaskStates(deps, taskTypes);
    await clearSessionQueueIfNeeded(deps, true);
    await deps.loadCountsSafely();
    notify.success('Deleted geometry cache');
  });
};

export const handleDeleteTileEmitCache = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  await deps.runDelete('tileEmit', async () => {
    await handleDeleteTileEmitArtifacts(deps, 'Deleted tile data');
  });
};

export const handleDeleteTransposeIndex = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  await deps.runDelete('transposeIndex', async () => {
    await handleDeleteTileEmitArtifacts(deps, 'Deleted transpose index');
  });
};

export const handleDeleteFeatureMetadata = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  const nodeId = deps.nodeId;
  await deps.runDelete('metadata', async () => {
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
    await deps.loadCountsSafely();
    notify.success('Deleted feature metadata');
  });
};

export const handleResetSession = async (deps: ActionDeps): Promise<void> => {
  if (!deps.nodeId) return;
  const nodeId = deps.nodeId;
  const taskQueue = new TileEmitTaskQueueDb();
  await deps.runDelete('resetSession', async () => {
    await deleteTasksByNode(taskQueue, nodeId);
    await shapeMutationAPIImpl.clearShapeArtifacts(nodeId);
    await Promise.all([
      shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId),
      shapeMutationAPIImpl.deleteDataSourceMetadataByNode(nodeId),
    ]);
    deps.setBuildTasks([]);
    deps.setPersistedTasks([]);
    deps.onResetSession?.();
    await deps.persistSessionReset();
    await deps.loadCountsSafely();
    notify.success('Reset session data');
  });
};
