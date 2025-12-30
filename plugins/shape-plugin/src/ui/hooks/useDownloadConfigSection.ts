import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { DownloadBatchConfig, BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import { getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB.js';
import { shapeDB } from '../../services/database/ShapeDB.js';
import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getShapeTileMetadataDB } from '../../services/database/VectorTileDB.ts';
import { useSetAtom } from 'jotai';
import { shapeBuildPersistedTasksAtom, shapeBuildTasksAtom } from '../state/shapeBuildProgressAtoms.js';

type Args = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  nodeId?: NodeId;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

const isVectorTileStage = (stage?: string): boolean => stage === 'vectortile' || stage === 'vectorTiles';

export const useDownloadConfigSection = ({ config, draft, nodeId, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseDownloadConfig: DownloadBatchConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;

  const db = getEphemeralShapeDB();
  const resolvedNodeId = nodeId ?? (draft as { nodeId?: NodeId })?.nodeId;
  const batchNodeId = resolvedNodeId ? toNodeId(String(resolvedNodeId)) : undefined;
  const bridgeRef = useMemo(() => getWorkerBridge(), []);

  const [counts, setCounts] = useState({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
  const [taskCounts, setTaskCounts] = useState({ vectortile: 0 });
  const [finalCounts, setFinalCounts] = useState({ tiles: 0, metadata: 0 });
  const [failedCounts, setFailedCounts] = useState({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
  const [persistedStatus, setPersistedStatus] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const setBuildTasks = useSetAtom(shapeBuildTasksAtom);
  const setPersistedTasks = useSetAtom(shapeBuildPersistedTasksAtom);
  const deleteLabel = useMemo(() => (
    counts.raw > 0
      ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete Downloaded Files ({{count}} files)', { count: counts.raw })
      : t('processing.download.deleteDownloadedFiles', 'Delete Downloaded Files')
  ), [counts.raw, t]);

  const loadCounts = useCallback(async () => {
    if (!batchNodeId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
      setFinalCounts({ tiles: 0, metadata: 0 });
      setFailedCounts({ download: 0, extract1: 0, extract2: 0, vectortile: 0 });
      setTaskCounts({ vectortile: 0 });
      return;
    }
    const [
      raw,
      stage1,
      stage2,
      tiles,
      cacheEntries,
      finalTiles,
      finalMetadata,
      vectortileTasks,
    ] = await Promise.all([
      db.rawBuffers.where('nodeId').equals(batchNodeId).count(),
      db.extractedBuffers.where({ nodeId: batchNodeId, stage: 'extract1' }).count(),
      db.extractedBuffers.where({ nodeId: batchNodeId, stage: 'extract2' }).count(),
      db.vectorTiles.where('nodeId').equals(batchNodeId).count(),
      db.cache.filter((entry) => entry.key.includes(batchNodeId)).count(),
      shapeDB.vectorTiles.where('nodeId').equals(batchNodeId).count(),
      getShapeTileMetadataDB()
        .then(async (metadataDb) => {
          const [featureCount, sourceCount] = await Promise.all([
            metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).count(),
            metadataDb.sourceMetadata.where('nodeId').equals(batchNodeId).count(),
          ]);
          return Math.max(featureCount, sourceCount);
        }),
      shapeDB.batchTasks
        .where('nodeId')
        .equals(batchNodeId)
        .and((task) => task.taskType === 'vectortile')
        .count(),
    ]);
    const failedTasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(batchNodeId)
      .and((task) => task.status === 'failed')
      .toArray();
    const failed = {
      download: failedTasks.filter((task) => task.taskType === 'download').length,
      extract1: failedTasks.filter((task) => task.taskType === 'extract1').length,
      extract2: failedTasks.filter((task) => task.taskType === 'extract2').length,
      vectortile: failedTasks.filter((task) => task.taskType === 'vectortile').length,
    };
    setCounts({ raw, stage1, stage2, tiles, cache: cacheEntries });
    setFinalCounts({ tiles: finalTiles, metadata: finalMetadata });
    setFailedCounts(failed);
    setTaskCounts({ vectortile: vectortileTasks });
  }, [batchNodeId, db, resolvedNodeId]);

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
  }, [config, loadCounts]);

  useEffect(() => {
    let cancelled = false;
    if (!batchNodeId) {
      setPersistedStatus(null);
      setStatusLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setStatusLoaded(false);
    shapeDB.batchSessions.get(batchNodeId).then((session) => {
      if (cancelled) return;
      setPersistedStatus(session?.status ?? null);
      setStatusLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setPersistedStatus(null);
      setStatusLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [batchNodeId]);

  const isRunning = !statusLoaded
    ? Boolean(batchNodeId)
    : persistedStatus === 'running';
  const hasFinalOutputs = finalCounts.tiles > 0 || finalCounts.metadata > 0;
  const canDeleteRaw = !isRunning && !disabled && (counts.raw > 0 || failedCounts.download > 0);
  const canDeleteStage1 = !isRunning && !disabled && (counts.stage1 > 0 || failedCounts.extract1 > 0);
  const canDeleteStage2 = !isRunning && !disabled && (counts.stage2 > 0 || failedCounts.extract2 > 0);
  const canDeleteTiles = !isRunning && !disabled && (
    counts.tiles > 0
    || failedCounts.vectortile > 0
    || hasFinalOutputs
    || taskCounts.vectortile > 0
  );
  const canDeleteMetadata = !isRunning && !disabled && finalCounts.metadata > 0;

  const clearBatchTasksForType = useCallback(async (taskType: string) => {
    if (!batchNodeId) return;
    await shapeDB.batchTasks
      .where('nodeId')
      .equals(batchNodeId)
      .and((task) => task.taskType === taskType)
      .delete();
  }, [batchNodeId]);

  const resetDownloadTasks = useCallback(async () => {
    if (!batchNodeId) return;
    const tasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(batchNodeId)
      .and((task) => task.taskType === 'download')
      .toArray();
    if (tasks.length === 0) return;
    const resetAt = Date.now();
    const resetTasks = tasks.map((task) => ({
      ...task,
      status: 'waiting' as const,
      progress: 0,
      message: undefined,
      startedAt: undefined,
      completedAt: undefined,
      retryCount: undefined,
      outputData: undefined,
      errorMessage: undefined,
      updatedAt: resetAt,
    }) as (typeof tasks)[number]);
    await shapeDB.batchTasks.bulkPut(resetTasks);
  }, [batchNodeId]);

  const clearFinalOutputs = useCallback(async () => {
    if (!batchNodeId) return;
    await shapeDB.vectorTiles.where('nodeId').equals(batchNodeId).delete();
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).delete();
    await metadataDb.sourceMetadata.where('nodeId').equals(batchNodeId).delete();
    await metadataDb.tiles.where('nodeId').equals(batchNodeId).delete();
  }, [batchNodeId, nodeId]);

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
    await db.clearStage(batchNodeId, 'download');
    await resetDownloadTasks();
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted downloaded files');
  }, [
    batchNodeId,
    clearFinalOutputs,
    db,
    loadCounts,
    onResetSession,
    persistSessionReset,
    resetDownloadTasks,
  ]);

  const handleDeleteStage = useCallback(async (stage: 'extract1' | 'extract2') => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await db.clearStage(batchNodeId, stage);
    await clearBatchTasksForType(stage);
    await loadCounts();
    notify.success(stage === 'extract1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [batchNodeId, clearBatchTasksForType, db, loadCounts]);

  const handleDeleteTiles = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await db.clearStage(batchNodeId, 'vectorTiles');
    await clearBatchTasksForType('vectortile');
    await clearFinalOutputs();
    setBuildTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    setPersistedTasks((prev) => prev.filter((task) => !isVectorTileStage(task.stage)));
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted tiles');
  }, [
    batchNodeId,
    clearBatchTasksForType,
    clearFinalOutputs,
    db,
    loadCounts,
    persistTileSummaryReset,
    setBuildTasks,
    setPersistedTasks,
  ]);

  const handleDeleteMetadata = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).delete();
    await metadataDb.sourceMetadata.where('nodeId').equals(batchNodeId).delete();
    await loadCounts();
    notify.success('Deleted metadata');
  }, [batchNodeId, loadCounts]);

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
