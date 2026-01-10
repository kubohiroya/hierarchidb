import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { DownloadBatchConfig, BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import { getShapeDbApiClient } from '../../services/batch/ShapeBatchApiClient.js';
import { toNodeId, type NodeId, type NodeType } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useSetAtom } from 'jotai';
import { shapeBuildPersistedTasksAtom, shapeBuildTasksAtom } from '../state/shapeBuildProgressAtoms.js';
import { VtTaskQueueDb, listTasksByStage, type TaskStage } from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, SHAPE_DOMAIN } from '@hierarchidb/vt-shape-store';

type Args = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  nodeId?: NodeId;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

const isVectorTileStage = (stage?: string): boolean => stage === 'vectortile' || stage === 'vectorTiles';
const SHAPE_NODE_TYPE = 'shape' as NodeType;

export const useDownloadConfigSection = ({ config, draft, nodeId, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseDownloadConfig: DownloadBatchConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;

  const { query, mutation, ephemeral } = getShapeDbApiClient();
  const resolvedNodeId = nodeId ?? (draft as { nodeId?: NodeId })?.nodeId;
  const batchNodeId = resolvedNodeId ? toNodeId(String(resolvedNodeId)) : undefined;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [counts, setCounts] = useState({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
  const [countsLoading, setCountsLoading] = useState(false);
  const [taskCounts, setTaskCounts] = useState({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
  const [finalCounts, setFinalCounts] = useState({ tiles: 0, metadata: 0 });
  const [failedCounts, setFailedCounts] = useState({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
  const [sessionRunning, setSessionRunning] = useState<boolean | null>(null);
  const setBuildTasks = useSetAtom(shapeBuildTasksAtom);
  const setPersistedTasks = useSetAtom(shapeBuildPersistedTasksAtom);
  const deleteLabel = useMemo(() => (
    counts.raw > 0
      ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete fetch cache ({{count}} items)', { count: counts.raw })
      : t('processing.download.deleteDownloadedFiles', 'Delete fetch cache')
  ), [counts.raw, t]);

  const loadCounts = useCallback(async () => {
    if (!batchNodeId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
      setFinalCounts({ tiles: 0, metadata: 0 });
      setFailedCounts({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
      setTaskCounts({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
      setSessionRunning(false);
      setCountsLoading(false);
      return;
    }
    setCountsLoading(true);
    try {
      const sessionStatusPromise = batchNodeId
        ? bridgeRef
          .initialize()
          .then(() => bridgeRef.getBatchSessionStatus(SHAPE_NODE_TYPE, batchNodeId))
          .catch(() => null)
        : Promise.resolve(null);
      const taskQueue = new VtTaskQueueDb();
      const vtShapeDb = new VtShapeDb();
      const [
        raw,
        stage1Count,
        stage1,
        stage2,
        tiles,
        cacheEntries,
        finalTiles,
        finalMetadata,
        downloadTasks,
        extract1Tasks,
        extract2Tasks,
        vectortileTasks,
        vtFetchTasks,
        vtTransformTasks,
        vtVtTasks,
        sessionStatus,
      ] = await Promise.all([
        ephemeral.countRawBuffers(batchNodeId),
        vtShapeDb.stage1Buffers
          .where('[nodeId+domainType]')
          .equals([batchNodeId, SHAPE_DOMAIN])
          .count(),
        ephemeral.countExtractedBuffers(batchNodeId, 'extract1'),
        ephemeral.countExtractedBuffers(batchNodeId, 'extract2'),
        ephemeral.countVectorTiles(batchNodeId),
        ephemeral.countCacheEntries(batchNodeId),
        query.getVectorTileSummary(batchNodeId).then((summary) => summary.tiles),
        Promise.all([
          query.listFeatureMetadata(batchNodeId),
          query.listSourceMetadata(batchNodeId),
        ]).then(([featureRows, sourceRows]) => Math.max(featureRows.length, sourceRows.length)),
        ephemeral.listBatchTasksByType(batchNodeId, 'download').then((rows) => rows.length),
        ephemeral.listBatchTasksByType(batchNodeId, 'extract1').then((rows) => rows.length),
        ephemeral.listBatchTasksByType(batchNodeId, 'extract2').then((rows) => rows.length),
        ephemeral.listBatchTasksByType(batchNodeId, 'vectortile').then((rows) => rows.length),
        listTasksByStage(taskQueue, batchNodeId, 'fetch'),
        listTasksByStage(taskQueue, batchNodeId, 'transform'),
        listTasksByStage(taskQueue, batchNodeId, 'vt'),
        sessionStatusPromise,
      ]);
      setSessionRunning(sessionStatus?.status === 'running' || sessionStatus?.status === 'paused');
      const failedTasks = await ephemeral.listBatchTasksByStatus(batchNodeId, 'failed');
      const vtFailedFetch = vtFetchTasks.filter((task) => task.status === 'failed').length;
      const vtFailedTransform = vtTransformTasks.filter((task) => task.status === 'failed').length;
      const vtFailedVt = vtVtTasks.filter((task) => task.status === 'failed').length;
      const failed = {
        download: failedTasks.filter((task) => task.taskType === 'download').length + vtFailedFetch,
        extract1: failedTasks.filter((task) => task.taskType === 'extract1').length + vtFailedTransform,
        extract2: failedTasks.filter((task) => task.taskType === 'extract2').length + vtFailedTransform,
        vectortile: failedTasks.filter((task) => task.taskType === 'vectortile').length + vtFailedVt,
      };
      setCounts({ raw: raw + stage1Count, stage1, stage2, tiles, cache: cacheEntries });
      setFinalCounts({ tiles: finalTiles, metadata: finalMetadata });
      setFailedCounts(failed);
      setTaskCounts({
        download: downloadTasks + vtFetchTasks.length,
        extract1: extract1Tasks + vtTransformTasks.length,
        extract2: extract2Tasks + vtTransformTasks.length,
        vectortile: vectortileTasks + vtVtTasks.length,
      });
    } finally {
      setCountsLoading(false);
    }
  }, [batchNodeId, bridgeRef, ephemeral, query, resolvedNodeId]);

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

  const isRunning = sessionRunning ?? draft?.processingStatus === 'processing';
  const hasFinalOutputs = finalCounts.tiles > 0 || finalCounts.metadata > 0;
  const canDeleteRaw = !isRunning && !disabled && (
    counts.raw > 0
    || failedCounts.download > 0
    || taskCounts.download > 0
  );
  const canDeleteStage1 = !isRunning && !disabled && (
    counts.stage1 > 0
    || failedCounts.extract1 > 0
    || taskCounts.extract1 > 0
  );
  const canDeleteStage2 = !isRunning && !disabled && (
    counts.stage2 > 0
    || failedCounts.extract2 > 0
    || taskCounts.extract2 > 0
  );
  const canDeleteTiles = !isRunning && !disabled && (
    counts.tiles > 0
    || failedCounts.vectortile > 0
    || hasFinalOutputs
    || taskCounts.vectortile > 0
  );
  const canDeleteMetadata = !isRunning && !disabled && finalCounts.metadata > 0;

  const resolveVtStage = useCallback((taskType: string): TaskStage | null => {
    switch (taskType) {
      case 'download':
        return 'fetch';
      case 'extract1':
      case 'extract2':
        return 'transform';
      case 'vectortile':
        return 'vt';
      default:
        return null;
    }
  }, []);

  const clearBatchTasksForType = useCallback(async (taskType: string) => {
    if (!batchNodeId) return;
    const rows = await ephemeral.listBatchTasksByType(batchNodeId, taskType as 'download' | 'extract1' | 'extract2' | 'vectortile');
    await ephemeral.deleteBatchTasksByIds(rows.map((task) => task.taskId));
    const vtStage = resolveVtStage(taskType);
    if (vtStage) {
      const taskQueue = new VtTaskQueueDb();
      await taskQueue.tasks
        .where('[nodeId+stage]')
        .equals([batchNodeId, vtStage])
        .delete();
    }
  }, [batchNodeId, ephemeral, resolveVtStage]);

  const clearFinalOutputs = useCallback(async () => {
    if (!batchNodeId) return;
    await mutation.deleteVectorTiles(batchNodeId);
    await mutation.deleteFeatureMetadataByNode(batchNodeId);
    await mutation.deleteSourceMetadataByNode(batchNodeId);
  }, [batchNodeId, mutation, nodeId]);

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

  const handleDeleteRaw = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await ephemeral.clearStage(batchNodeId, 'download');
    await clearBatchTasksForType('download');
    const vtShapeDb = new VtShapeDb();
    await vtShapeDb.stage1Buffers
      .where('[nodeId+domainType]')
      .equals([batchNodeId, SHAPE_DOMAIN])
      .delete();
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted fetch cache');
  }, [
    batchNodeId,
    bridgeRef,
    clearBatchTasksForType,
    clearFinalOutputs,
    ephemeral,
    isRunning,
    loadCounts,
    nodeId,
    onResetSession,
    persistSessionReset,
  ]);

  const handleDeleteStage = useCallback(async (stage: 'extract1' | 'extract2') => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await ephemeral.clearStage(batchNodeId, stage);
    await clearBatchTasksForType(stage);
    setBuildTasks((prev) => prev.filter((task) => task.stage !== stage && task.stage !== 'transform'));
    setPersistedTasks((prev) => prev.filter((task) => task.stage !== stage && task.stage !== 'transform'));
    await loadCounts();
    notify.success(stage === 'extract1'
      ? 'Deleted transform cache (filtering)'
      : 'Deleted transform cache (preprocessing)');
  }, [batchNodeId, clearBatchTasksForType, ephemeral, loadCounts, setBuildTasks, setPersistedTasks]);

  const handleDeleteTiles = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await ephemeral.clearStage(batchNodeId, 'vectorTiles');
    await clearBatchTasksForType('vectortile');
    await clearFinalOutputs();
    setBuildTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    setPersistedTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted vt cache');
  }, [
    batchNodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    ephemeral,
    loadCounts,
    persistTileSummaryReset,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteMetadata = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await mutation.deleteFeatureMetadataByNode(batchNodeId);
    await mutation.deleteSourceMetadataByNode(batchNodeId);
    await loadCounts();
    notify.success('Deleted metadata');
  }, [batchNodeId, loadCounts, mutation]);

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
  }, [config, onChange]);

  const handleResetDefaults = useCallback(() => {
    const defaultDownloadConfig: DownloadBatchConfig = DEFAULT_PROCESSING_CONFIG.downloadConfig ?? { maxConcurrent: 2 };
    onChange(mergeBatchConfig({
      ...DEFAULT_PROCESSING_CONFIG,
      downloadConfig: defaultDownloadConfig,
      dataSource: config.dataSource ?? DEFAULT_PROCESSING_CONFIG.dataSource,
    }));
  }, [config.dataSource, onChange]);

  if (!baseDownloadConfig) {
    throw new Error('DownloadConfigSection: baseDownloadConfig is not defined');
  }

  return {
    t,
    switchId,
    baseDownloadConfig,
    deleteLabel,
    countsLoading,
    canDeleteRaw,
    canDeleteStage1,
    canDeleteStage2,
    canDeleteTiles,
    canDeleteMetadata,
    handleDeleteRaw,
    handleDeleteStage,
    handleDeleteTiles,
    handleDeleteMetadata,
    handleResetDefaults,
    update,
  };
};
