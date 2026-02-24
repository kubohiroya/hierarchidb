import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { persistedTasksAtom, tasksAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import {
  loadCacheCounts,
  clearBuildTasksForStages,
  SHAPE_NODE_TYPE,
  type CacheCounts,
  type ResultCounts,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.helpers.js';
import {
  handleDeleteFetchApiCache as handleDeleteFetchApiCacheAction,
  handleDeleteFetchFilteredCache as handleDeleteFetchFilteredCacheAction,
  handleDeleteFeatureMetadata,
  handleResetSession as handleResetSessionAction,
  handleDeleteVTCache as handleDeleteVTCacheAction,
  handleDeleteTransposeIndex as handleDeleteTransposeIndexAction,
  handleDeleteTransformCache as handleDeleteTransformCacheAction,
  type CacheActionKey,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.handlers.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';

type BuildBridge = {
  initialize: () => Promise<void>;
  getBuildSessionStatus: (nodeType: NodeType, nodeId: NodeId) => Promise<BuildSessionStatus>;
};

export type DeleteLoadingState = {
  fetchApi: boolean;
  fetchFiltered: boolean;
  transform: boolean;
  vt: boolean;
  transposeIndex: boolean;
  metadata: boolean;
  resetSession: boolean;
};

type Args = {
  nodeId?: NodeId;
  disabled?: boolean;
  onResetSession?: () => void;
};

const initialCounts: CacheCounts = {
  fetchApi: 0,
  fetchFiltered: 0,
  transform: 0,
  vt: 0,
};

const initialResultCounts: ResultCounts = {
  tiles: 0,
  featureMetadata: 0,
  transformErrors: 0,
};

type ActionDeps = {
  nodeId?: NodeId;
  sessionStatus: BuildSessionStatus['status'] | null;
  runDelete: (key: CacheActionKey, action: () => Promise<void>) => Promise<void>;
  loadCountsSafely: () => Promise<void>;
  hasPersistedOutputs: () => Promise<boolean>;
  hasRunningBuildSession: () => Promise<boolean>;
  onResetSession?: () => void;
  persistSessionReset: () => Promise<void>;
  setBuildTasks: ReturnType<typeof useSetAtom<typeof tasksAtom>>;
  setPersistedTasks: ReturnType<typeof useSetAtom<typeof persistedTasksAtom>>;
  runClearTaskQueueStages: (taskTypes: Parameters<typeof clearBuildTasksForStages>[2]) => Promise<void>;
};

export const useShapeBuildCacheActions = ({ nodeId, disabled, onResetSession }: Args) => {
  const bridgeRef = useMemo<BuildBridge>(() => getBuildWorkerBridge(), []);
  const [countsLoading, setCountsLoading] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const [resultCounts, setResultCounts] = useState(initialResultCounts);
  const [deleteLoading, setDeleteLoading] = useState<DeleteLoadingState>({
    fetchApi: false,
    fetchFiltered: false,
    transform: false,
    vt: false,
    transposeIndex: false,
    metadata: false,
    resetSession: false,
  });
  const [sessionStatus, setSessionStatus] = useState<BuildSessionStatus['status'] | null>(null);
  const setBuildTasks = useSetAtom(tasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);

  const runClearTaskQueueStages = useCallback(
    async (taskTypes: Parameters<typeof clearBuildTasksForStages>[2]) => {
      if (!nodeId) return;
      const taskQueue = new VtTaskQueueDb();
      await clearBuildTasksForStages(taskQueue, nodeId, taskTypes);
    },
    [nodeId],
  );

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts(initialCounts);
      setResultCounts(initialResultCounts);
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
    void (async () => {
      await loadCounts();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCounts]);

  const runDelete = useCallback(
    async (key: CacheActionKey, action: () => Promise<void>): Promise<void> => {
      setDeleteLoading((prev) => ({ ...prev, [key]: true }));
      try {
        await action();
      } finally {
        setDeleteLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [],
  );

  const loadCountsSafely = useCallback(async () => {
    try {
      await loadCounts();
    } catch (error) {
      console.warn('[shapeBuildCache] failed to reload delete counts', error);
    }
  }, [loadCounts]);

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

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await shapeMutationAPIImpl.deleteBuildSession(nodeId);
      setSessionStatus(null);
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [nodeId]);

  const deps = useMemo(
    () => ({
      nodeId,
      sessionStatus,
      runDelete,
      loadCountsSafely,
      hasPersistedOutputs,
      hasRunningBuildSession,
      onResetSession,
      persistSessionReset,
      setBuildTasks,
      setPersistedTasks,
      runClearTaskQueueStages,
    } satisfies ActionDeps),
    [
      hasPersistedOutputs,
      hasRunningBuildSession,
      nodeId,
      onResetSession,
      persistSessionReset,
      runClearTaskQueueStages,
      runDelete,
      sessionStatus,
      setBuildTasks,
      setPersistedTasks,
      loadCountsSafely,
    ],
  );

  const handleDeleteFetchApiCache = useCallback(async () => {
    await handleDeleteFetchApiCacheAction(deps);
  }, [deps]);
  const handleDeleteFetchFilteredCache = useCallback(async () => {
    await handleDeleteFetchFilteredCacheAction(deps);
  }, [deps]);
  const handleDeleteTransformCache = useCallback(async () => {
    await handleDeleteTransformCacheAction(deps);
  }, [deps]);
  const handleDeleteVTCache = useCallback(async () => {
    await handleDeleteVTCacheAction(deps);
  }, [deps]);
  const handleDeleteTransposeIndex = useCallback(async () => {
    await handleDeleteTransposeIndexAction(deps);
  }, [deps]);
  const handleDeleteMetadata = useCallback(async () => {
    await handleDeleteFeatureMetadata(deps);
  }, [deps]);
  const handleResetSession = useCallback(async () => {
    await handleResetSessionAction(deps);
  }, [deps]);

  const allowDeleteWhileBusy = (
    sessionStatus !== null && ['running', 'paused', 'failed', 'queued'].includes(sessionStatus)
  );
  const deleteEnabled = allowDeleteWhileBusy || !disabled;
  const canDeleteFetchApiCache = deleteEnabled && counts.fetchApi > 0;
  const canDeleteFetchFilteredCache = deleteEnabled && counts.fetchFiltered > 0;
  const canDeleteTransformCache = deleteEnabled && counts.transform > 0;
  const canDeleteVTCache = deleteEnabled && counts.vt > 0;
  const canDeleteTransposeIndex = deleteEnabled && counts.vt > 0;
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
    canDeleteTransposeIndex,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteTransposeIndex,
    handleDeleteMetadata,
    handleResetSession,
  };
};
