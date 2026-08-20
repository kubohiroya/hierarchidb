import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuildSessionStatus } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { notify } from '@hierarchidb/components';
import {
  RESET_LEGACY_BUILD_SESSION_AND_TASKS,
  type ShapeBuildSessionRecoverableContractError,
  type ShapeMutationAPI,
} from '@hierarchidb/shape-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { VtTaskQueueDb as TileEmitTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import {
  loadCacheCounts,
  clearBuildTasksForStages,
  SHAPE_NODE_TYPE,
  type CacheCounts,
  type ResultCounts,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.helpers.js';
import {
  handleDeleteSourceApiCache as handleDeleteSourceApiCacheAction,
  handleDeleteSourceFilteredCache as handleDeleteSourceFilteredCacheAction,
  handleDeleteFeatureMetadata,
  handleResetSession as handleResetSessionAction,
  handleDeleteTileEmitCache as handleDeleteTileEmitCacheAction,
  handleDeleteTransposeIndex as handleDeleteTransposeIndexAction,
  handleDeleteGeometryCache as handleDeleteGeometryCacheAction,
  type CacheActionKey,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.handlers.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';

type BuildBridge = {
  initialize: () => Promise<void>;
  getBuildSessionStatus: (nodeType: NodeType, nodeId: NodeId) => Promise<BuildSessionStatus>;
  getShapeMutationAPI: () => Promise<ShapeMutationAPI>;
};

export type DeleteLoadingState = {
  sourceApi: boolean;
  sourceFiltered: boolean;
  geometry: boolean;
  tileEmit: boolean;
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
  sourceApi: 0,
  sourceFiltered: 0,
  geometry: 0,
  tileEmit: 0,
};

const initialResultCounts: ResultCounts = {
  tiles: 0,
  featureMetadata: 0,
  geometryErrors: 0,
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
  runClearTaskQueueStages: (taskTypes: Parameters<typeof clearBuildTasksForStages>[2]) => Promise<void>;
};

export const useShapeBuildCacheActions = ({ nodeId, disabled, onResetSession }: Args) => {
  const bridgeRef = useMemo<BuildBridge>(() => getBuildWorkerBridge(), []);
  const [countsLoading, setCountsLoading] = useState(false);
  const [counts, setCounts] = useState(initialCounts);
  const [resultCounts, setResultCounts] = useState(initialResultCounts);
  const [deleteLoading, setDeleteLoading] = useState<DeleteLoadingState>({
    sourceApi: false,
    sourceFiltered: false,
    geometry: false,
    tileEmit: false,
    transposeIndex: false,
    metadata: false,
    resetSession: false,
  });
  const [sessionStatus, setSessionStatus] = useState<BuildSessionStatus['status'] | null>(null);

  const runClearTaskQueueStages = useCallback(
    async (taskTypes: Parameters<typeof clearBuildTasksForStages>[2]) => {
      if (!nodeId) return;
      const taskQueue = new TileEmitTaskQueueDb();
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
    const [summary, featureMetadata, geometryErrors] = await Promise.all([
      shapeQueryAPIImpl.getVectorTileSummary(nodeId),
      shapeQueryAPIImpl.listFeatureMetadata(nodeId),
      shapeQueryAPIImpl.listGeometryErrorRecords(nodeId),
    ]);
    return summary.tiles > 0 || featureMetadata.length > 0 || geometryErrors.length > 0;
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
      loadCountsSafely,
    ],
  );

  const handleDeleteSourceApiCache = useCallback(async () => {
    await handleDeleteSourceApiCacheAction(deps);
  }, [deps]);
  const handleDeleteSourceFilteredCache = useCallback(async () => {
    await handleDeleteSourceFilteredCacheAction(deps);
  }, [deps]);
  const handleDeleteGeometryCache = useCallback(async () => {
    await handleDeleteGeometryCacheAction(deps);
  }, [deps]);
  const handleDeleteTileEmitCache = useCallback(async () => {
    await handleDeleteTileEmitCacheAction(deps);
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
  const handleRecoverLegacyBuildSession = useCallback(
    async (error: ShapeBuildSessionRecoverableContractError) => {
      if (!nodeId) {
        throw new Error(
          '[useShapeBuildCacheActions] nodeId is required for legacy session recovery'
        );
      }
      await runDelete('resetSession', async () => {
        await bridgeRef.initialize();
        const mutationAPI = await bridgeRef.getShapeMutationAPI();
        await mutationAPI.recoverLegacyBuildSession({
          nodeId,
          confirmation: RESET_LEGACY_BUILD_SESSION_AND_TASKS,
          error,
        });
        setSessionStatus(null);
        await loadCountsSafely();
        notify.success('Recovered legacy build session');
      });
    },
    [bridgeRef, loadCountsSafely, nodeId, runDelete]
  );

  const allowDeleteWhileBusy = (
    sessionStatus !== null && ['running', 'paused', 'failed', 'queued'].includes(sessionStatus)
  );
  const deleteEnabled = allowDeleteWhileBusy || !disabled;
  const canDeleteSourceApiCache = deleteEnabled && counts.sourceApi > 0;
  const canDeleteSourceFilteredCache = deleteEnabled && counts.sourceFiltered > 0;
  const canDeleteGeometryCache = deleteEnabled && counts.geometry > 0;
  const canDeleteTileEmitCache = deleteEnabled && counts.tileEmit > 0;
  const canDeleteTransposeIndex = deleteEnabled && counts.tileEmit > 0;
  const canDeleteMetadata = deleteEnabled && resultCounts.featureMetadata > 0;

  return {
    counts,
    resultCounts,
    countsLoading,
    deleteLoading,
    canDeleteSourceApiCache,
    canDeleteSourceFilteredCache,
    canDeleteGeometryCache,
    canDeleteTileEmitCache,
    canDeleteTransposeIndex,
    canDeleteMetadata,
    handleDeleteSourceApiCache,
    handleDeleteSourceFilteredCache,
    handleDeleteGeometryCache,
    handleDeleteTileEmitCache,
    handleDeleteTransposeIndex,
    handleDeleteMetadata,
    handleResetSession,
    handleRecoverLegacyBuildSession,
  };
};
