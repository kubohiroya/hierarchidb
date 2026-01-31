import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { ShapeBuildConfig } from '../../../common/types/index.js';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { persistedTasksAtom, tasksAtom } from '../../atoms/shapeBuildProgressAtoms.js';
import { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import type { BuildTaskType } from '@hierarchidb/shape-store';
import { ephemeralShapeAPIImpl, shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';
import {
  countRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNode,
} from '../../../services/utils/chunkStore.js';

type Args = {
  config: ShapeBuildConfig;
  nodeId: NodeId;
  draft: Partial<ShapeEntity>;
  disabled?: boolean;
  onChange: (next: ShapeBuildConfig) => void;
  onResetSession?: () => void;
};

const isVectorTileStage = (stage: TaskStage): boolean => stage === 'vt';
const SHAPE_NODE_TYPE = 'shape' as NodeType;

type CacheCounts = {
  fetchApi: number;
  fetchFiltered: number;
  transform: number;
  vt: number;
};

type StageLikeTask = {
  stage: TaskStage;
  type?: TaskStage;
  taskType?: TaskStage;
};

const resolveTaskStage = (task: StageLikeTask): TaskStage =>
  task.stage ?? task.type ?? task.taskType;

const isFetchTask = (task: StageLikeTask): boolean => resolveTaskStage(task) === 'fetch';
const isTransformTask = (task: StageLikeTask): boolean => resolveTaskStage(task) === 'transform';

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig = config.fetchConfig;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [countsLoading, setCountsLoading] = useState(false);

  const [counts, setCounts] = useState<CacheCounts>({
    fetchApi: 0,
    fetchFiltered: 0,
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
  const fetchApiDeleteCount = counts.fetchApi;
  const fetchFilteredDeleteCount = counts.fetchFiltered;
  const transformDeleteCount = counts.transform;
  const vtDeleteCount = counts.vt;
  const metadataDeleteCount = resultCounts.metadata;
  const hasTileSummary = Boolean(draft?.tileSummary && (draft.tileSummary.tiles ?? 0) > 0);
  const deleteFetchApiLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteApiCacheWithCount',
      t('processing.download.deleteApiCache', 'Delete API cache'),
      fetchApiDeleteCount,
    )
  ), [fetchApiDeleteCount, formatDeleteLabelI18n, t]);
  const deleteFetchFilteredLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteFilteredCacheWithCount',
      t('processing.download.deleteFilteredCache', 'Delete filtered cache'),
      fetchFilteredDeleteCount,
    )
  ), [fetchFilteredDeleteCount, formatDeleteLabelI18n, t]);
  const deleteTransformLabel = useMemo(() => (
    formatDeleteLabelI18n(
      'processing.download.deleteStage1CacheWithCount',
      t('processing.download.deleteStage1Cache', 'Delete simplified cache'),
      transformDeleteCount,
    )
  ), [formatDeleteLabelI18n, t, transformDeleteCount]);
  const deleteVTLabel = useMemo(() => (
    formatDeleteLabel(
      t('processing.download.deleteTiles', 'Delete tile index + tile data cache'),
      vtDeleteCount,
    )
  ), [formatDeleteLabel, t, vtDeleteCount]);
  const deleteMetadataLabel = useMemo(() => (
    formatDeleteLabel(t('processing.download.deleteMetadata', 'Delete Metadata'), metadataDeleteCount)
  ), [formatDeleteLabel, metadataDeleteCount, t]);

  const loadCounts = useCallback(async () => {
    if (!nodeId) {
      setCounts({ fetchApi: 0, fetchFiltered: 0, transform: 0, vt: 0 });
      setResultCounts({ tiles: 0, metadata: 0 });
      setIsRunning(false);
      setCountsLoading(false);
      return;
    }

    setCountsLoading(true);

    try {
      const taskQueue = new VtTaskQueueDb();
      const [
        fetchCacheCount,
        rawCacheCount,
        transformTaskCount,
        vtTaskCount,
        transformCacheCount,
        numMetadata,
      ] = await Promise.all([
        ephemeralShapeAPIImpl.countFetchCaches(nodeId),
        countRawDataDataSourceBuffersForNode(nodeId),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'transform']).count(),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'vt']).count(),
        ephemeralShapeAPIImpl.countTransformCaches(nodeId),
        shapeQueryAPIImpl.listFeatureMetadata(nodeId).then((rows) => rows.length),
      ]);
      const transformCount = transformTaskCount > 0 ? transformTaskCount : transformCacheCount;

      const sessionStatus = await bridgeRef
        .initialize()
        .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, nodeId))
        .catch(() => null);

      setIsRunning(sessionStatus?.status === 'running');

      setCounts({
        fetchApi: rawCacheCount,
        fetchFiltered: fetchCacheCount,
        transform: transformCount,
        vt: vtTaskCount,
      });
      setResultCounts({ tiles: vtTaskCount, metadata: numMetadata });
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

  const canDeleteFetchApiCache = !isRunning && !disabled && fetchApiDeleteCount > 0;
  const canDeleteFetchFilteredCache = !isRunning && !disabled && fetchFilteredDeleteCount > 0;
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

  const hasPersistedOutputs = useCallback(async (): Promise<boolean> => {
    if (!nodeId) return false;
    const [summary, sourceMetadata, transformErrors] = await Promise.all([
      shapeQueryAPIImpl.getVectorTileSummary(nodeId),
      shapeQueryAPIImpl.listSourceMetadata(nodeId),
      shapeQueryAPIImpl.listTransformErrorRecords(nodeId),
    ]);
    return summary.tiles > 0 || sourceMetadata.length > 0 || transformErrors.length > 0;
  }, [nodeId]);

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

  const handleDeleteFetchApiCache = useCallback(async () => {
    await deleteRawDataDataSourceBuffersForNode(nodeId);
    await clearBatchTasksForType('fetch');
    setBuildTasks((prev) => prev.filter((task) => !isFetchTask(task)));
    setPersistedTasks((prev) => prev.filter((task) => !isFetchTask(task)));
    await loadCounts();
    notify.success('Deleted API cache');
  }, [nodeId, clearBatchTasksForType, loadCounts, setBuildTasks, setPersistedTasks]);

  const handleDeleteFetchFilteredCache = useCallback(async () => {
    await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
    await clearBatchTasksForType('fetch');
    setBuildTasks((prev) => prev.filter((task) => !isFetchTask(task)));
    setPersistedTasks((prev) => prev.filter((task) => !isFetchTask(task)));
    await loadCounts();
    const shouldPreserveSession = draft?.processingStatus === 'completed' || hasTileSummary || await hasPersistedOutputs();
    if (!shouldPreserveSession) {
      onResetSession?.();
      await persistSessionReset();
    }
    notify.success('Deleted filtered cache');
  }, [
    nodeId,
    clearBatchTasksForType,
    draft?.processingStatus,
    hasPersistedOutputs,
    hasTileSummary,
    loadCounts,
    onResetSession,
    persistSessionReset,
    setBuildTasks,
    setPersistedTasks,
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
    deleteFetchApiLabel,
    deleteFetchFilteredLabel,
    deleteTransformFilterLabel: deleteTransformLabel,
    deleteVTLabel,
    deleteMetadataLabel,
    countsLoading,
    canDeleteFetchApiCache,
    canDeleteFetchFilteredCache,
    canDeleteTransformCache,
    canDeleteVTCache,
    canDeleteMetadata,
    handleDeleteFetchApiCache,
    handleDeleteFetchFilteredCache,
    handleDeleteTransformCache,
    handleDeleteVTCache,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};

export type FetchConfigSectionState = ReturnType<typeof useFetchConfigSection>;
