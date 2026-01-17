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
  transform: number;
  vt: number;
};

type StageLikeTask = {
  stage?: string;
  type?: string;
  taskType?: string;
};

const resolveTaskStage = (task: StageLikeTask): string | undefined =>
  task.stage ?? task.type ?? task.taskType;

const isTransformTask = (task: StageLikeTask): boolean => resolveTaskStage(task) === 'transform';

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig = config.fetchConfig;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [countsLoading, setCountsLoading] = useState(false);

  const [counts, setCounts] = useState<CacheCounts>({
    fetch: 0,
    transform: 0,
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
  const formatDeleteLabelI18n = useCallback((key: string, fallback: string, count: number) => (
    count > 0
      ? t(key, '{{label}} ({{count}}{{unit}})', {
        label: fallback,
        count,
        unit: countUnit,
      })
      : fallback
  ), [countUnit, t]);
  const fetchDeleteCount = counts.fetch;
  const transformDeleteCount = counts.transform;
  const vtDeleteCount = Math.max(counts.vt, resultCounts.tiles);
  const metadataDeleteCount = resultCounts.metadata;
  const deleteFetchLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteDownloadedFilesWithCount',
      t('processing.download.deleteDownloadedFiles', 'Delete fetch cache'),
      fetchDeleteCount,
    )
  ), [fetchDeleteCount, formatDeleteLabelI18n, t]);
  const deleteTransformLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteStage1CacheWithCount',
      t('processing.download.deleteStage1Cache', 'Delete transform cache'),
      transformDeleteCount,
    )
  ), [formatDeleteLabelI18n, t, transformDeleteCount]);
  const deleteVTLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteTiles', 'Delete vt cache'), vtDeleteCount)
  ), [formatDeleteLabel, t, vtDeleteCount]);
  const deleteMetadataLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteMetadata', 'Delete Metadata'), metadataDeleteCount)
  ), [formatDeleteLabel, metadataDeleteCount, t]);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetch: 0, transform: 0, vt: 0 });
      setResultCounts({ tiles: 0, metadata: 0 });
      setIsRunning(false);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const shapeStore = new VtShapeDb();
      const taskQueue = new VtTaskQueueDb();
      const [
        fetchCount,
        transformTaskCount,
        transformCacheCount,
        numTiles,
        numMetadata,
      ] = await Promise.all([
        shapeStore.fetchCache.where('[nodeId+domainType]').equals([nodeId, SHAPE_DOMAIN]).count(),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'transform']).count(),
        ephemeralShapeAPIImpl.countTransformCaches(nodeId),
        shapeQueryAPIImpl.listVTMetadata(nodeId).then((rows) => rows.length),
        shapeQueryAPIImpl.listFeatureMetadata(nodeId).then((rows) => rows.length),
      ]);
      const transformCount = transformTaskCount > 0 ? transformTaskCount : transformCacheCount;

      const sessionStatus = await bridgeRef
        .initialize()
        .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, nodeId))
        .catch(() => null);

      setIsRunning(sessionStatus?.status === 'running');

      setCounts({
        fetch: fetchCount,
        transform: transformCount,
        vt: numTiles,
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
  const canDeleteTransformCache = !isRunning && !disabled && transformDeleteCount > 0;
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
      if (vtStage === 'transform') {
        await taskQueue.tasks
          .where('nodeId')
          .equals(nodeId)
          .and((task) => !['fetch', 'transform', 'vt'].includes(task.stage))
          .delete();
      }
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

  const handleDeleteTransformCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
    await clearBatchTasksForType('transform');
    setBuildTasks((prev) => prev.filter((task) => !isTransformTask(task)));
    setPersistedTasks((prev) => prev.filter((task) => !isTransformTask(task)));
    await loadCounts();
    notify.success('Deleted transform cache');
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
    deleteTransformFilterLabel: deleteTransformLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    canDeleteFetchCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};

export type FetchConfigSectionState = ReturnType<typeof useFetchConfigSection>;
