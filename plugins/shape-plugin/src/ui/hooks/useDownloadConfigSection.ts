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
import { getShapeTileMetadataDB } from '../../services/database/ShapeTileMetadataDB.js';

type Args = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  nodeId?: NodeId;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

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
  const [finalCounts, setFinalCounts] = useState({ tiles: 0, metadata: 0 });
  const [failedCounts, setFailedCounts] = useState({ download: 0, simplify1: 0, simplify2: 0, vectortile: 0 });
  const [persistedStatus, setPersistedStatus] = useState<string | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const deleteLabel = useMemo(() => (
    counts.raw > 0
      ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete Downloaded Files ({{count}} files)', { count: counts.raw })
      : t('processing.download.deleteDownloadedFiles', 'Delete Downloaded Files')
  ), [counts.raw, t]);

  const loadCounts = useCallback(async () => {
    if (!batchNodeId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
      setFinalCounts({ tiles: 0, metadata: 0 });
      setFailedCounts({ download: 0, simplify1: 0, simplify2: 0, vectortile: 0 });
      return;
    }
    const [raw, stage1, stage2, tiles, cacheEntries, finalTiles, finalMetadata] = await Promise.all([
      db.rawBuffers.where('nodeId').equals(batchNodeId).count(),
      db.simplifiedBuffers.where({ nodeId: batchNodeId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ nodeId: batchNodeId, stage: 'simplify2' }).count(),
      db.vectorTiles.where('nodeId').equals(batchNodeId).count(),
      db.cache.filter((entry) => entry.key.includes(batchNodeId)).count(),
      shapeDB.vectorTiles.where('nodeId').equals(batchNodeId).count(),
      getShapeTileMetadataDB()
        .then((metadataDb) =>
          metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).count()
        ),
    ]);
    const failedTasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(batchNodeId)
      .and((task) => task.status === 'failed')
      .toArray();
    const failed = {
      download: failedTasks.filter((task) => task.taskType === 'download').length,
      simplify1: failedTasks.filter((task) => task.taskType === 'simplify1').length,
      simplify2: failedTasks.filter((task) => task.taskType === 'simplify2').length,
      vectortile: failedTasks.filter((task) => task.taskType === 'vectortile').length,
    };
    setCounts({ raw, stage1, stage2, tiles, cache: cacheEntries });
    setFinalCounts({ tiles: finalTiles, metadata: finalMetadata });
    setFailedCounts(failed);
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
  const canDeleteStage1 = !isRunning && !disabled && (counts.stage1 > 0 || failedCounts.simplify1 > 0);
  const canDeleteStage2 = !isRunning && !disabled && (counts.stage2 > 0 || failedCounts.simplify2 > 0);
  const canDeleteTiles = !isRunning && !disabled && (
    counts.tiles > 0
    || failedCounts.vectortile > 0
    || hasFinalOutputs
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

  const clearFinalOutputs = useCallback(async () => {
    if (!batchNodeId) return;
    await shapeDB.vectorTiles.where('nodeId').equals(batchNodeId).delete();
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).delete();
    await metadataDb.tiles.where('nodeId').equals(batchNodeId).delete();
    await metadataDb.tiles.where('nodeId').equals(`input:${batchNodeId}`).delete();
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
    await clearBatchTasksForType('download');
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted downloaded files');
  }, [batchNodeId, clearBatchTasksForType, clearFinalOutputs, db, loadCounts, onResetSession, persistSessionReset]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await db.clearStage(batchNodeId, stage);
    await clearBatchTasksForType(stage);
    await loadCounts();
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [batchNodeId, clearBatchTasksForType, db, loadCounts]);

  const handleDeleteTiles = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    await db.clearStage(batchNodeId, 'vectorTiles');
    await clearBatchTasksForType('vectortile');
    await clearFinalOutputs();
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted tiles');
  }, [batchNodeId, clearBatchTasksForType, clearFinalOutputs, db, loadCounts, persistTileSummaryReset]);

  const handleDeleteMetadata = useCallback(async () => {
    if (!batchNodeId) return notify.warning('NodeId is missing.');
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('nodeId').equals(batchNodeId).delete();
    await loadCounts();
    notify.success('Deleted metadata');
  }, [batchNodeId, loadCounts]);

  const update = useCallback((partial: Partial<BatchConfig>) => {
    onChange(mergeBatchConfig({ ...config, ...partial }));
  }, [config, onChange]);

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
    update,
  };
};
