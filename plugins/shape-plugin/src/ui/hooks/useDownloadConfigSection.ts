import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { DownloadBatchConfig, BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import { getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB.js';
import { shapeDB } from '../../services/database/ShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../i18n.js';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { getShapeTileMetadataDB } from '../../services/database/ShapeTileMetadataDB.js';
import { resolveShapeSessionId } from '../utils/sessionInvalidation.js';

type Args = {
  config: BatchConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: BatchConfig) => void;
  onResetSession?: () => void;
};

export const useDownloadConfigSection = ({ config, draft, disabled, onChange, onResetSession }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseDownloadConfig: DownloadBatchConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;

  const db = getEphemeralShapeDB();
  const nodeId = (draft as { nodeId?: NodeId })?.nodeId;
  const sessionId = resolveShapeSessionId(draft);
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
    if (!sessionId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
      setFinalCounts({ tiles: 0, metadata: 0 });
      setFailedCounts({ download: 0, simplify1: 0, simplify2: 0, vectortile: 0 });
      return;
    }
    const [raw, stage1, stage2, tiles, cacheEntries, finalTiles, finalMetadata] = await Promise.all([
      db.rawBuffers.where('sessionId').equals(sessionId).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
      db.vectorTiles.where('sessionId').equals(sessionId).count(),
      db.cache.filter((entry) => entry.key.includes(sessionId)).count(),
      shapeDB.vectorTiles.where('nodeId').equals(String(nodeId ?? sessionId)).count(),
      getShapeTileMetadataDB()
        .then((metadataDb) =>
          metadataDb.featureMetadata.where('sessionId').equals(sessionId).count()
        ),
    ]);
    const failedTasks = await shapeDB.batchTasks
      .where('sessionId')
      .equals(sessionId)
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
  }, [db, nodeId, sessionId]);

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
    if (!sessionId) {
      setPersistedStatus(null);
      setStatusLoaded(true);
      return () => {
        cancelled = true;
      };
    }
    setStatusLoaded(false);
    shapeDB.batchSessions.get(sessionId).then((session) => {
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
  }, [sessionId]);

  const isRunning = !statusLoaded
    ? Boolean(sessionId)
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
    if (!sessionId) return;
    await shapeDB.batchTasks
      .where('sessionId')
      .equals(sessionId)
      .and((task) => task.taskType === taskType)
      .delete();
  }, [sessionId]);

  const clearFinalOutputs = useCallback(async () => {
    if (!sessionId) return;
    const finalNodeId = String(nodeId ?? sessionId);
    await shapeDB.vectorTiles.where('nodeId').equals(finalNodeId).delete();
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('sessionId').equals(sessionId).delete();
  }, [nodeId, sessionId]);

  const persistSessionReset = useCallback(async () => {
    if (!nodeId) return;
    try {
      await bridgeRef.initialize();
      const updater = await bridgeRef.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: {
          ...(draft ?? {}),
          batchSessionId: undefined,
          processingStatus: 'idle',
          tileSummary: undefined,
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
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'download');
    await clearBatchTasksForType('download');
    await clearFinalOutputs();
    await loadCounts();
    onResetSession?.();
    await persistSessionReset();
    notify.success('Deleted downloaded files');
  }, [clearBatchTasksForType, clearFinalOutputs, db, loadCounts, onResetSession, persistSessionReset, sessionId]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, stage);
    await clearBatchTasksForType(stage);
    await loadCounts();
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [clearBatchTasksForType, db, loadCounts, sessionId]);

  const handleDeleteTiles = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'vectorTiles');
    await clearBatchTasksForType('vectortile');
    await clearFinalOutputs();
    await persistTileSummaryReset();
    await loadCounts();
    notify.success('Deleted tiles');
  }, [clearBatchTasksForType, clearFinalOutputs, db, loadCounts, persistTileSummaryReset, sessionId]);

  const handleDeleteMetadata = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    const metadataDb = await getShapeTileMetadataDB();
    await metadataDb.featureMetadata.where('sessionId').equals(sessionId).delete();
    await loadCounts();
    notify.success('Deleted metadata');
  }, [loadCounts, sessionId]);

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
