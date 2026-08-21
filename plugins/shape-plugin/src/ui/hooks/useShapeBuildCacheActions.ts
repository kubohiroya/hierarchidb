import type { BuildSessionStatus } from '@hierarchidb/build-api';
import { notify } from '@hierarchidb/components';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  RESET_LEGACY_BUILD_SESSION_AND_TASKS,
  type ShapeBuildSessionRecoverableContractError,
  type ShapeBuildStopReason,
  type ShapeMutationAPI,
} from '@hierarchidb/shape-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { VtTaskQueueDb as TileEmitTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import {
  buildSessionLifecycleAtom,
  type ShapeSessionPhase,
} from '~/ui/atoms/buildSessionStateAtoms';
import {
  type CacheActionKey,
  handleDeleteFeatureMetadata,
  handleDeleteGeometryCache as handleDeleteGeometryCacheAction,
  handleDeleteSourceApiCache as handleDeleteSourceApiCacheAction,
  handleDeleteSourceFilteredCache as handleDeleteSourceFilteredCacheAction,
  handleDeleteTileEmitCache as handleDeleteTileEmitCacheAction,
  handleDeleteTransposeIndex as handleDeleteTransposeIndexAction,
  handleResetSession as handleResetSessionAction,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.handlers.js';
import {
  type CacheCounts,
  clearBuildTasksForStages,
  loadCacheCounts,
  type ResultCounts,
  SHAPE_NODE_TYPE,
} from './useShapeBuildCacheActions/useShapeBuildCacheActions.helpers.js';

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
  sessionPhase: ShapeSessionPhase;
  runDelete: (key: CacheActionKey, action: () => Promise<void>) => Promise<void>;
  loadCountsSafely: () => Promise<void>;
  hasPersistedOutputs: () => Promise<boolean>;
  hasRunningBuildSession: () => Promise<boolean>;
  onResetSession?: () => void;
  persistSessionReset: () => Promise<void>;
  runClearTaskQueueStages: (
    taskTypes: Parameters<typeof clearBuildTasksForStages>[2]
  ) => Promise<void>;
};

type RefreshOutcome = 'completed' | 'failed' | 'queued-cancel';

const resolveRefreshOutcome = (
  phase: ShapeSessionPhase,
  stopReason: ShapeBuildStopReason | undefined
): RefreshOutcome | null => {
  if (phase === 'completed' || phase === 'failed') {
    return phase;
  }
  if (phase === 'idle' && stopReason !== undefined) {
    return 'queued-cancel';
  }
  return null;
};

export const useShapeBuildCacheActions = ({ nodeId, disabled, onResetSession }: Args) => {
  const bridgeRef = useMemo<BuildBridge>(() => getBuildWorkerBridge(), []);
  const lifecycle = useAtomValue(buildSessionLifecycleAtom);
  const latestNodeIdRef = useRef(nodeId);
  const loadGenerationRef = useRef(0);
  const lifecycleRefreshRef = useRef<{
    initialized: boolean;
    nodeId?: NodeId;
    outcome: RefreshOutcome | null;
  }>({ initialized: false, outcome: null });
  latestNodeIdRef.current = nodeId;
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

  const runClearTaskQueueStages = useCallback(
    async (taskTypes: Parameters<typeof clearBuildTasksForStages>[2]) => {
      if (!nodeId) return;
      const taskQueue = new TileEmitTaskQueueDb();
      await clearBuildTasksForStages(taskQueue, nodeId, taskTypes);
    },
    [nodeId]
  );

  const loadCounts = useCallback(async () => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    if (!nodeId) {
      setCounts(initialCounts);
      setResultCounts(initialResultCounts);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);
    try {
      const result = await loadCacheCounts({ nodeId });
      if (generation !== loadGenerationRef.current || latestNodeIdRef.current !== nodeId) {
        return;
      }
      setCounts(result.counts);
      setResultCounts(result.resultCounts);
    } finally {
      if (generation === loadGenerationRef.current && latestNodeIdRef.current === nodeId) {
        setCountsLoading(false);
      }
    }
  }, [nodeId]);

  useEffect(() => {
    const tracker = lifecycleRefreshRef.current;
    const outcome = resolveRefreshOutcome(lifecycle.phase, lifecycle.stopReason);
    const nodeChanged = !tracker.initialized || tracker.nodeId !== nodeId;

    if (nodeChanged) {
      tracker.initialized = true;
      tracker.nodeId = nodeId;
      tracker.outcome = outcome;
      void loadCounts().catch((error: unknown) => {
        console.warn('[shapeBuildCache] failed to load counts', error);
      });
      return;
    }

    if (outcome === null) {
      tracker.outcome = null;
      return;
    }
    if (tracker.outcome === outcome) {
      return;
    }

    tracker.outcome = outcome;
    void loadCounts().catch((error: unknown) => {
      console.warn('[shapeBuildCache] failed to load terminal counts', error);
    });
  }, [lifecycle.phase, lifecycle.stopReason, loadCounts, nodeId]);

  const runDelete = useCallback(
    async (key: CacheActionKey, action: () => Promise<void>): Promise<void> => {
      setDeleteLoading((prev) => ({ ...prev, [key]: true }));
      try {
        await action();
      } finally {
        setDeleteLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    []
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
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [nodeId]);

  const deps = useMemo(
    () =>
      ({
        nodeId,
        sessionPhase: lifecycle.phase,
        runDelete,
        loadCountsSafely,
        hasPersistedOutputs,
        hasRunningBuildSession,
        onResetSession,
        persistSessionReset,
        runClearTaskQueueStages,
      }) satisfies ActionDeps,
    [
      hasPersistedOutputs,
      hasRunningBuildSession,
      nodeId,
      onResetSession,
      persistSessionReset,
      runClearTaskQueueStages,
      runDelete,
      lifecycle.phase,
      loadCountsSafely,
    ]
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
        await loadCountsSafely();
        notify.success('Recovered legacy build session');
      });
    },
    [bridgeRef, loadCountsSafely, nodeId, runDelete]
  );

  const allowDeleteWhileBusy =
    lifecycle.isActive || lifecycle.phase === 'paused' || lifecycle.phase === 'failed';
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
