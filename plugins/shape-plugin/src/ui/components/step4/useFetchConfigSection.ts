import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { persistedTasksAtom, tasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, SHAPE_DOMAIN } from '@hierarchidb/vt-shape-store';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

type Args = {
  config: ShapeBuildConfig;
  nodeId: NodeId;
  draft: Partial<ShapeEntity>;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
  onResetSession?: () => void;
};

const isVectorTileStage = (stage?: string): boolean => stage === 'vt';
const SHAPE_NODE_TYPE = 'shape' as NodeType;

type CacheCounts = {
  fetch: number;
  transformByBand: number;
  transformByZoom: number;
  vt: number;
};

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig = config.fetchConfig;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [countsLoading, setCountsLoading] = useState(false);

  const [counts, setCounts] = useState<CacheCounts>({
    fetch: 0,
    transformByBand: 0,
    transformByZoom: 0,
    vt: 0,
  });
  const [resultCounts, setResultCounts] = useState({ tiles: 0, metadata: 0 });

  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const setBuildTasks = useSetAtom(tasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);
  const countUnit = t('processing.download.countUnit', '');
  const formatDeleteLabel = useCallback((label: string, count: number, unit = '') => (
    count > 0 ? `${label} (${count}${unit})` : label
  ), []);
  const fetchDeleteCount = counts.fetch;
  const transformByBandDeleteCount = counts.transformByBand;
  const transformByZoomDeleteCount = counts.transformByZoom;
  const vtDeleteCount = Math.max(counts.vt, resultCounts.tiles);
  const metadataDeleteCount = resultCounts.metadata;
  const deleteFetchLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteFetchedFiles', 'Delete fetch cache'), fetchDeleteCount)
  ), [fetchDeleteCount, formatDeleteLabel, t]);
  const deleteTransformByBandLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteStage1Cache', 'Delete zoom-band cache'), transformByBandDeleteCount, countUnit)
  ), [countUnit, formatDeleteLabel, t, transformByBandDeleteCount]);
  const deleteTransformByZoomLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteStage2Cache', 'Delete zoom-ratio cache'), transformByZoomDeleteCount, countUnit)
  ), [countUnit, formatDeleteLabel, t, transformByZoomDeleteCount]);
  const deleteVTLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteTiles', 'Delete vt cache'), vtDeleteCount)
  ), [formatDeleteLabel, t, vtDeleteCount]);
  const deleteMetadataLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteMetadata', 'Delete Metadata'), metadataDeleteCount)
  ), [formatDeleteLabel, metadataDeleteCount, t]);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetch: 0, transformByBand: 0, transformByZoom: 0, vt: 0 });
      setResultCounts({ tiles: 0, metadata: 0 });
      setIsRunning(false);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const shapeStore = new VtShapeDb();
      const [
        fetchCount,
        transformByBandCount,
        transformByZoomCount,
        vtCount,
        numTiles,
        numMetadata,
      ] = await Promise.all([
        shapeStore.fetchCache.where('[nodeId+domainType]').equals([nodeId, SHAPE_DOMAIN]).count(),
        ephemeralShapeAPIImpl.countTransformByBandCaches(nodeId),
        ephemeralShapeAPIImpl.listTileIdRelations(nodeId).then((rows) => rows.length),
        ephemeralShapeAPIImpl.countVectorTiles(nodeId),
        shapeQueryAPIImpl.listVTMetadata(nodeId).then((rows) => rows.length),
        shapeQueryAPIImpl.listFeatureMetadata(nodeId).then((rows) => rows.length),
      ]);

      const sessionStatus = await bridgeRef
        .initialize()
        .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, nodeId))
        .catch(() => null);

      setIsRunning(sessionStatus?.status === 'running');

      setCounts({
        fetch: fetchCount,
        transformByBand: transformByBandCount,
        transformByZoom: transformByZoomCount,
        vt: vtCount,
      });
      setResultCounts({ tiles: numTiles, metadata: numMetadata });
    } finally {
      setCountsLoading(false);
    }
  }, [nodeId, bridgeRef]);

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

  const canDeleteFetchCache = !isRunning && !disabled && fetchDeleteCount > 0;
  const canDeleteTransformByBandCache = !isRunning && !disabled && transformByBandDeleteCount > 0;
  const canDeleteTransformByZoomCache = !isRunning && !disabled && transformByZoomDeleteCount > 0;
  const canDeleteVTCache = !isRunning && !disabled && vtDeleteCount > 0;
  const canDeleteMetadata = !isRunning && !disabled && metadataDeleteCount > 0;

  const clearBatchTasksForType = useCallback(async (taskType: BuildTaskType) => {
    const rows = await ephemeralShapeAPIImpl.listBuildTasksByType(nodeId, taskType);
    await ephemeralShapeAPIImpl.deleteBuildTasksByIds(rows.map((task) => task.taskId));
    const vtStage = taskType;
    if (vtStage) {
      const taskQueue = new VtTaskQueueDb();
      await taskQueue.tasks
        .where('[nodeId+stage]')
        .equals([nodeId, vtStage])
        .delete();
    }
  }, [nodeId]);

  const clearFinalOutputs = useCallback(async () => {
    await shapeMutationAPIImpl.deleteVectorTiles(nodeId);
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
    await shapeMutationAPIImpl.deleteSourceMetadataByNode(nodeId);
  }, [nodeId]);

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(draft ?? {}),
          processingStatus: 'idle',
          tileSummary: undefined,
          buildStartedAt: undefined,
          buildFinishedAt: undefined,
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist session reset', error);
    }
  }, [bridgeRef, draft, nodeId]);

  const persistTileSummaryReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(draft ?? {}),
          tileSummary: undefined,
        } as Record<string, unknown>,
      });
    } catch (error) {
      console.warn('[ShapeDownloadConfigSection] failed to persist tile summary reset', error);
    }
  }, [bridgeRef, draft, nodeId]);

  const handleDeleteFetchCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
    await clearBatchTasksForType('fetch');
    const vtShapeDb = new VtShapeDb();
    await vtShapeDb.fetchCache
      .where('[nodeId+domainType]')
      .equals([nodeId, SHAPE_DOMAIN])
      .delete();
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted fetch cache');
  }, [
    nodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    loadCounts,
    onResetSession,
    persistSessionReset,
  ]);

  const handleDeleteTransformByBandCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform-by-band');
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform-by-zoom');
    await clearBatchTasksForType('transform-by-band');
    await clearBatchTasksForType('transform-by-zoom');
    setBuildTasks((prev) => prev.filter((task) => task.stage !== 'transform-by-band' && task.stage !== 'transform-by-zoom'));
    setPersistedTasks((prev) => prev.filter((task) => task.stage !== 'transform-by-band' && task.stage !== 'transform-by-zoom'));
    await loadCounts();
    notify.success('Deleted transform-by-band cache');
  }, [nodeId, clearBatchTasksForType, loadCounts, setBuildTasks, setPersistedTasks]);

  const handleDeleteTransformByZoomCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform-by-zoom');
    await clearBatchTasksForType('transform-by-zoom');
    setBuildTasks((prev) => prev.filter((task) => task.stage !== 'transform-by-zoom'));
    setPersistedTasks((prev) => prev.filter((task) => task.stage !== 'transform-by-zoom'));
    await loadCounts();
    notify.success('Deleted transform-by-zoom cache');
  }, [nodeId, clearBatchTasksForType, loadCounts, setBuildTasks, setPersistedTasks]);

  const handleDeleteVTCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'vt');
    await clearBatchTasksForType('vt');
    await clearFinalOutputs();
    setBuildTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    setPersistedTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted vt cache');
  }, [
    nodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    loadCounts,
    persistTileSummaryReset,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteMetadata = useCallback(async () => {
    await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
    await shapeMutationAPIImpl.deleteSourceMetadataByNode(nodeId);
    await loadCounts();
    notify.success('Deleted metadata');
  }, [nodeId, loadCounts]);

  const update = useCallback((partial: Partial<ShapeBuildConfig>) => {
    onChange(mergeBuildConfig(config, partial));
  }, [config, onChange]);

  const handleResetDefaults = useCallback(() => {
    onChange({
      ...DEFAULT_BUILD_CONFIG,
      dataSourceName: config.dataSourceName,
    });
  }, [config.dataSourceName, onChange]);

  return {
    t,
    switchId,
    baseFetchConfig: baseFetchConfig,
    deleteFetchLabel,
    deleteTransformFilterLabel: deleteTransformByBandLabel,
    deleteTransformPreprocessLabel: deleteTransformByZoomLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    canDeleteFetchCache,
    canDeleteTransformCache: canDeleteTransformByBandCache,
    canDeleteTransformByZoomCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchCache,
    handleDeleteTransformCache: handleDeleteTransformByBandCache,
    handleDeleteTransformByZoomCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};
