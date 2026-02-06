import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { ShapeEntity } from '../../../common/types/index.js';
import { DEFAULT_BUILD_CONFIG, mergeBuildConfig } from '../../../common/types/index.js';
import type { BatchSessionStatus, TaskStage } from '@hierarchidb/batch-api';
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

const SHAPE_NODE_TYPE = 'shape' as NodeType;

type CacheCounts = {
  fetchApi: number;
  fetchFiltered: number;
  transform: number;
  vt: number;
};

type DeleteLoadingState = {
  fetchApi: boolean;
  fetchFiltered: boolean;
  transform: boolean;
  vt: boolean;
  metadata: boolean;
};

type StageLikeTask = {
  stage: TaskStage;
  type?: TaskStage;
  taskType?: TaskStage;
};

const resolveTaskStage = (task: StageLikeTask): TaskStage =>
  task.stage ?? task.type ?? task.taskType;

const isTaskInStages = (task: StageLikeTask, stages: TaskStage[]): boolean =>
  stages.includes(resolveTaskStage(task));

export const useFetchConfigSection = ({ config, nodeId, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseFetchConfig = config.fetchConfig;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [countsLoading, setCountsLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<DeleteLoadingState>({
    fetchApi: false,
    fetchFiltered: false,
    transform: false,
    vt: false,
    metadata: false,
  });

  const [counts, setCounts] = useState<CacheCounts>({
    fetchApi: 0,
    fetchFiltered: 0,
    transform: 0,
    vt: 0,
  });
  const [resultCounts, setResultCounts] = useState({ tiles: 0, metadata: 0, transformErrors: 0 });

  const [sessionStatus, setSessionStatus] = useState<BatchSessionStatus['status'] | null>(null);
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
      setResultCounts({ tiles: 0, metadata: 0, transformErrors: 0 });
      setSessionStatus(null);
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
        vectorTileSummary,
        featureMetadata,
        sourceMetadata,
        transformErrors,
      ] = await Promise.all([
        ephemeralShapeAPIImpl.countFetchCaches(nodeId),
        countRawDataDataSourceBuffersForNode(nodeId),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'transform']).count(),
        taskQueue.tasks.where('[nodeId+stage]').equals([nodeId, 'vt']).count(),
        ephemeralShapeAPIImpl.countTransformCaches(nodeId),
        shapeQueryAPIImpl.getVectorTileSummary(nodeId),
        shapeQueryAPIImpl.listFeatureMetadata(nodeId),
        shapeQueryAPIImpl.listSourceMetadata(nodeId),
        shapeQueryAPIImpl.listTransformErrorRecords(nodeId),
      ]);
      const metadataCount = featureMetadata.length + sourceMetadata.length;
      const transformErrorCount = transformErrors.length;
      const transformCount = transformTaskCount + transformCacheCount + transformErrorCount;
      const tileCount = vtTaskCount + vectorTileSummary.tiles;

      const sessionStatus = await bridgeRef
        .initialize()
        .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, nodeId))
        .catch(() => null);

      setSessionStatus(sessionStatus?.status ?? null);

      setCounts({
        fetchApi: rawCacheCount,
        fetchFiltered: fetchCacheCount,
        transform: transformCount,
        vt: tileCount,
      });
      setResultCounts({ tiles: vectorTileSummary.tiles, metadata: metadataCount, transformErrors: transformErrorCount });
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

  const draftStatus = draft?.processingStatus ?? null;
  const allowDeleteWhileBusy = (
    (sessionStatus !== null && ['running', 'paused', 'failed', 'queued'].includes(sessionStatus))
    || (draftStatus !== null && ['processing', 'paused', 'failed'].includes(draftStatus))
  );
  const deleteEnabled = allowDeleteWhileBusy || !disabled;
  const canDeleteFetchApiCache = deleteEnabled && fetchApiDeleteCount > 0;
  const canDeleteFetchFilteredCache = deleteEnabled && fetchFilteredDeleteCount > 0;
  const canDeleteTransformCache = deleteEnabled && transformDeleteCount > 0;
  const canDeleteVTCache = deleteEnabled && vtDeleteCount > 0;
  const canDeleteMetadata = deleteEnabled && metadataDeleteCount > 0;

  const runDelete = useCallback(async (
    key: keyof DeleteLoadingState,
    action: () => Promise<void>,
  ): Promise<void> => {
    setDeleteLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await action();
    } finally {
      setDeleteLoading((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const clearBatchTasksForStages = useCallback(async (taskTypes: BuildTaskType[]) => {
    const uniqueTypes = Array.from(new Set(taskTypes));
    if (uniqueTypes.length === 0) return;
    const taskRows = await Promise.all(
      uniqueTypes.map((taskType) => ephemeralShapeAPIImpl.listBuildTasksByType(nodeId, taskType))
    );
    const taskIds = taskRows.flatMap((rows) => rows.map((task) => task.taskId));
    if (taskIds.length > 0) {
      await ephemeralShapeAPIImpl.deleteBuildTasksByIds(taskIds);
    }
    const taskQueue = new VtTaskQueueDb();
    await Promise.all(
      uniqueTypes.map((stage) => (
        taskQueue.tasks
          .where('[nodeId+stage]')
          .equals([nodeId, stage])
          .delete()
      )),
    );
    if (uniqueTypes.includes('transform')) {
      await taskQueue.tasks
        .where('nodeId')
        .equals(nodeId)
        .and((task) => {
          const stage = task.stage;
          if (!stage) return true;
          return !['fetch', 'transform', 'vt'].includes(stage);
        })
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
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchApi', async () => {
      await deleteRawDataDataSourceBuffersForNode(nodeId);
      await clearBatchTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await loadCounts();
      notify.success('Deleted API cache');
    });
  }, [nodeId, clearBatchTasksForStages, loadCounts, runDelete, setBuildTasks, setPersistedTasks]);

  const handleDeleteFetchFilteredCache = useCallback(async () => {
    const stagesToClear: BuildTaskType[] = ['fetch', 'transform', 'vt'];
    await runDelete('fetchFiltered', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'fetch');
      await clearBatchTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await loadCounts();
      const shouldPreserveSession = draft?.processingStatus === 'completed' || hasTileSummary || await hasPersistedOutputs();
      if (!shouldPreserveSession) {
        onResetSession?.();
        await persistSessionReset();
      }
      notify.success('Deleted filtered cache');
    });
  }, [
    nodeId,
    clearBatchTasksForStages,
    draft?.processingStatus,
    hasPersistedOutputs,
    hasTileSummary,
    loadCounts,
    onResetSession,
    persistSessionReset,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteTransformCache = useCallback(async () => {
    const stagesToClear: BuildTaskType[] = ['transform', 'vt'];
    await runDelete('transform', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'transform');
      await clearBatchTasksForStages(stagesToClear);
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await loadCounts();
      notify.success('Deleted transform cache');
    });
  }, [nodeId, clearBatchTasksForStages, loadCounts, runDelete, setBuildTasks, setPersistedTasks]);

  const handleDeleteVTCache = useCallback(async () => {
    const stagesToClear: BuildTaskType[] = ['vt'];
    await runDelete('vt', async () => {
      await ephemeralShapeAPIImpl.clearStage(nodeId, 'vt');
      await clearBatchTasksForStages(stagesToClear);
      await clearFinalOutputs();
      setBuildTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      setPersistedTasks((prev) => prev.filter((task) => !isTaskInStages(task, stagesToClear)));
      await persistTileSummaryReset();
      await loadCounts();
      notify.success('Deleted vt cache');
    });
  }, [
    nodeId,
    clearBatchTasksForStages,
    clearFinalOutputs,
    loadCounts,
    persistTileSummaryReset,
    runDelete,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteMetadata = useCallback(async () => {
    await runDelete('metadata', async () => {
      await shapeMutationAPIImpl.deleteFeatureMetadataByNode(nodeId);
      await shapeMutationAPIImpl.deleteSourceMetadataByNode(nodeId);
      await loadCounts();
      notify.success('Deleted metadata');
    });
  }, [nodeId, loadCounts, runDelete]);

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
    deleteFetchApiLoading: deleteLoading.fetchApi,
    deleteFetchFilteredLoading: deleteLoading.fetchFiltered,
    deleteTransformLoading: deleteLoading.transform,
    deleteVTLoading: deleteLoading.vt,
    deleteMetadataLoading: deleteLoading.metadata,
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
