import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { DownloadBatchConfig, BatchConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeBatchConfig } from '../../common/types/index.js';
import { getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB.js';
import { shapeDB } from '../../services/database/ShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../i18n.js';

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
  const sessionId = (draft as { nodeId?: NodeId })?.nodeId
    ?? (draft as { batchSessionId?: string })?.batchSessionId;
  const processingStatus = (draft as { processingStatus?: string })?.processingStatus ?? 'idle';

  const [counts, setCounts] = useState({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
  const [failedCounts, setFailedCounts] = useState({ download: 0, simplify1: 0, simplify2: 0, vectortile: 0 });
  const deleteLabel = useMemo(() => (
    counts.raw > 0
      ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete Downloaded Files ({{count}} files)', { count: counts.raw })
      : t('processing.download.deleteDownloadedFiles', 'Delete Downloaded Files')
  ), [counts.raw, t]);

  const loadCounts = useCallback(async () => {
    if (!sessionId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0, cache: 0 });
      setFailedCounts({ download: 0, simplify1: 0, simplify2: 0, vectortile: 0 });
      return;
    }
    const [raw, stage1, stage2, tiles, cacheEntries] = await Promise.all([
      db.rawBuffers.where('sessionId').equals(sessionId).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
      db.vectorTiles.where('sessionId').equals(sessionId).count(),
      db.cache.filter((entry) => entry.key.includes(sessionId)).count(),
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
    setFailedCounts(failed);
  }, [db, sessionId]);

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

  const isRunning = processingStatus === 'processing';
  const canDeleteRaw = !isRunning && !disabled && (counts.raw > 0 || failedCounts.download > 0 || counts.cache > 0);
  const canDeleteStage1 = !isRunning && !disabled && (counts.stage1 > 0 || failedCounts.simplify1 > 0 || counts.cache > 0);
  const canDeleteStage2 = !isRunning && !disabled && (counts.stage2 > 0 || failedCounts.simplify2 > 0 || counts.cache > 0);
  const canDeleteTiles = !isRunning && !disabled && (counts.tiles > 0 || failedCounts.vectortile > 0 || counts.cache > 0);

  const deleteTasksForStage = useCallback(async (stage: 'download' | 'simplify1' | 'simplify2' | 'vectortile') => {
    if (!sessionId) return;
    const taskIds = await shapeDB.batchTasks
      .where('sessionId')
      .equals(sessionId)
      .and((task) => task.taskType === stage)
      .primaryKeys();
    await shapeDB.batchTasks.bulkDelete(taskIds);
  }, [sessionId]);

  const handleDeleteRaw = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'download');
    await deleteTasksForStage('download');
    await loadCounts();
    onResetSession?.();
    notify.success('Deleted downloaded files');
  }, [db, deleteTasksForStage, loadCounts, onResetSession, sessionId]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, stage);
    await deleteTasksForStage(stage);
    await loadCounts();
    onResetSession?.();
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [db, deleteTasksForStage, loadCounts, onResetSession, sessionId]);

  const handleDeleteTiles = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'vectorTiles');
    await deleteTasksForStage('vectortile');
    await loadCounts();
    onResetSession?.();
    notify.success('Deleted tiles');
  }, [db, deleteTasksForStage, loadCounts, onResetSession, sessionId]);

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
    handleDeleteRaw,
    handleDeleteStage,
    handleDeleteTiles,
    update,
  };
};
