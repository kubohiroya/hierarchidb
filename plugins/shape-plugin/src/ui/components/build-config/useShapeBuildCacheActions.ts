import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuildSessionStatus } from '@hierarchidb/batch-api';
import type { NodeId } from '@hierarchidb/core-types';
import { notify } from '@hierarchidb/components';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { persistedTasksAtom, tasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';
import { deleteTasksByNode, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import {
  clearBuildTasksForStages,
  deleteFetchRawCache,
  isTaskInStages,
  loadCacheCounts,
  SHAPE_NODE_TYPE,
  type CacheCounts,
  type ResultCounts,
} from './useShapeBuildCacheActions.helpers.js';
 

export type DeleteLoadingState = {
  fetchApi: boolean;
  fetchFiltered: boolean;
  transform: boolean;
  vt: boolean;
  metadata: boolean;
  resetSession: boolean;
};

type Args = {
  nodeId?: NodeId;
  disabled?: boolean;
  onResetSession?: () => void;
};

export const useShapeBuildCacheActions = ({ nodeId, disabled, onResetSession }: Args) => {
  const bridgeRef = useMemo(() => getBuildWorkerBridge(), []);
  const [countsLoading, setCountsLoading] = useState(false);
  const [counts, setCounts] = useState<CacheCounts>({
    fetchApi: 0,
    fetchFiltered: 0,
    transform: 0,
    vt: 0,
  });
  const [resultCounts, setResultCounts] = useState<ResultCounts>({
    tiles: 0,
    featureMetadata: 0,
    transformErrors: 0,
  });
  const [deleteLoading, setDeleteLoading] = useState<DeleteLoadingState>({
    fetchApi: false,
    fetchFiltered: false,
    transform: false,
    vt: false,
    metadata: false,
    resetSession: false,
  });
  const [sessionStatus, setSessionStatus] = useState<BuildSessionStatus['status'] | null>(null);
  const setBuildTasks = useSetAtom(tasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetchApi: 0, fetchFiltered: 0, transform: 0, vt: 0 });
      setResultCounts({ tiles: 0, featureMetadata: 0, transformErrors: 0 });
      setSessionStatus(null);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const result = await loadCacheCounts({
        nodeId,
        sessionBridge: bridgeRef,
      });
      setSessionStatus(result.sessionStatus);
      setCounts(result.counts);
      setResultCounts(result.resultCounts);
    } finally {
      setCountsLoading(false);
    }
  }, [bridgeRef, nodeId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await loadCounts();
      if (cancelled) return;
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCounts]);

  const runDelete = useCallback(async (key: keyof DeleteLoadingState, action: () => Promise<void>): Promise<void> => {
    setDeleteLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } finally {
      setDeleteLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const loadCountsSafely = useCallback(async (): Promise<void> => {
    try {
      await loadCounts();
    } catch (error) {
      console.warn('[shapeBuildCache] failed to reload delete counts', error);
    }
  }, [loadCounts]);

  const runClearTaskQueueStages = useCallback(async (taskTypes: BuildTaskType[]) => {
    if (!nodeId) return;
    const taskQueue = new VtTaskQueueDb();
    await clearBuildTasksForStages(taskQueue, nodeId, taskTypes);
  }, [nodeId]);

  const clearTileData = useCallback(async () => {
    if (!nodeId) return;
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
  }, [nodeId]);

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await shapeMutationAPIImpl.deleteBuildSession(nodeId);
      setSessionStatus(null);
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [nodeId]);

  const hasPersistedOutputs = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    const [summary, featureMetadata, transformErrors] = await Promise.all([
      shapeQueryAPIImpl.getVectorTileSummary(nodeId),
      shapeQueryAPIImpl.listFeatureMetadata(nodeId),
      shapeQueryAPIImpl.listTransformErrorRecords(nodeId),
    ]);
    return summary.tiles > 0 || featureMetadata.length > 0 || transformErrors.length > 0;
  }, [nodeId]);

  const hasRunningBuildSession = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    try {
      await bridgeRef.initialize();
      const status = await bridgeRef.getBuildSessionStatus(SHAPE_NODE_TYPE, nodeId);
      return status.status === 'running';
    } catch {
      return false;
    }
  }, [bridgeRef, nodeId]);

  const resetStaleProcessingSessionIfNeeded = useCallback(async (): Promise<boolean> => {
    if (sessionStatus !== 'running') return false;
    const running = await hasRunningBuildSession();
    if (running) return false;
    onResetSession?.();
    await persistSessionReset();
    return true;
  }, [
    hasRunningBuildSession,
    onResetSession,
    persistSessionReset,
    sessionStatus,
  ]);

  const handleDeleteFetchApiCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchApi', async () => {
      let deletedApiCache = false;
      try {
        await deleteFetchRawCache(nodeId);
        deletedApiCache = true;
        setCounts((prev: CacheCounts) => ({ ...prev, fetchApi: 0 }));
      } catch (error) {
        console.warn('[shapeBuildCache] failed to delete fetch API cache', error);
        notify.error('Failed to delete API cache.');
      }

      try {
        await runClearTaskQueueStages(stagesToClear);
        setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
        setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
        await resetStaleProcessingSessionIfNeeded();
      } catch (error) {
        console.warn('[shapeBuildCache] failed to clear build task metadata', error);
        notify.error('Failed to remove API cache related task data.');
      }

      await loadCountsSafely();
      if (deletedApiCache) {
        notify.success('Deleted API cache');
      }
    });
  }, [
    runClearTaskQueueStages,
    loadCountsSafely,
    nodeId,
    runDelete,
    resetStaleProcessingSessionIfNeeded,
    setBuildTasks,
    setPersistedTasks,
    setCounts,
  ]);

  const handleDeleteFetchFilteredCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchFiltered', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
      await runClearTaskQueueStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      const resetByStaleProcessing = await resetStaleProcessingSessionIfNeeded();
      const shouldPreserveSession = sessionStatus === 'completed' || await hasPersistedOutputs();
      if (!shouldPreserveSession && !resetByStaleProcessing) {
        onResetSession?.();
        await persistSessionReset();
      }
      await loadCountsSafely();
      notify.success('Deleted filtered cache');
    });
  }, [
    runClearTaskQueueStages,
    hasPersistedOutputs,
    loadCountsSafely,
    nodeId,
    onResetSession,
    persistSessionReset,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    sessionStatus,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteTransformCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['transform', 'vt'];
    await runDelete('transform', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
      await runClearTaskQueueStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      const resetByStaleProcessing = await resetStaleProcessingSessionIfNeeded();
      if (!resetByStaleProcessing) {
        onResetSession?.();
        await persistSessionReset();
      }
      await loadCountsSafely();
      notify.success('Deleted transform cache');
    });
  }, [
    runClearTaskQueueStages,
    loadCountsSafely,
    nodeId,
    onResetSession,
    persistSessionReset,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteVTCache = useCallback(async () => {
    if (!nodeId) return;
    const stagesToClear: BuildTaskType[] = ['vt'];
    await runDelete('vt', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'vt');
      await runClearTaskQueueStages(stagesToClear);
      await clearTileData();
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      const resetByStaleProcessing = await resetStaleProcessingSessionIfNeeded();
      const shouldPreserveSession = sessionStatus === 'completed' || await hasPersistedOutputs();
      if (!shouldPreserveSession && !resetByStaleProcessing) {
        onResetSession?.();
        await persistSessionReset();
      }
      await loadCountsSafely();
      notify.success('Deleted tile data');
    });
  }, [
    runClearTaskQueueStages,
    clearTileData,
    hasPersistedOutputs,
    loadCountsSafely,
    nodeId,
    onResetSession,
    persistSessionReset,
    resetStaleProcessingSessionIfNeeded,
    runDelete,
    sessionStatus,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteFeatureMetadata = useCallback(async () => {
    if (!nodeId) return;
    await runDelete('metadata', async () => {
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
      await loadCountsSafely();
      notify.success('Deleted feature metadata');
    });
  }, [loadCountsSafely, nodeId, runDelete]);

  const handleResetSession = useCallback(async () => {
    if (!nodeId) return;
    await runDelete('resetSession', async () => {
      const taskQueue = new VtTaskQueueDb();
      await deleteTasksByNode(taskQueue, nodeId);
      await deleteFetchRawCache(nodeId);
      await shapeMutationAPIImpl.clearShapeArtifacts(nodeId);
      await Promise.all([
        shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId),
        shapeMutationAPIImpl.deleteDataSourceMetadataByNode(nodeId),
      ]);
      setBuildTasks([]);
      setPersistedTasks([]);
      onResetSession?.();
      await persistSessionReset();
      await loadCountsSafely();
      notify.success('Reset session data');
    });
  }, [
    loadCountsSafely,
    nodeId,
    onResetSession,
    persistSessionReset,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const allowDeleteWhileBusy = (
    sessionStatus !== null && ['running', 'paused', 'failed', 'queued'].includes(sessionStatus)
  );
  const deleteEnabled = allowDeleteWhileBusy || !disabled;
  const canDeleteFetchApiCache = deleteEnabled && counts.fetchApi > 0;
  const canDeleteFetchFilteredCache = deleteEnabled && counts.fetchFiltered > 0;
  const canDeleteTransformCache = deleteEnabled && counts.transform > 0;
  const canDeleteVTCache = deleteEnabled && counts.vt > 0;
  const canDeleteMetadata = deleteEnabled && resultCounts.featureMetadata > 0;

  return {
    counts,
    resultCounts,
    countsLoading,
    deleteLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata: handleDeleteFeatureMetadata,
    handleResetSession,
  };
};
