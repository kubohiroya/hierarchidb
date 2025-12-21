import { useCallback, useEffect, useMemo, useState } from 'react';
import { useId } from 'react';
import type { DownloadProcessingConfig, ProcessingConfig, ShapeEntity } from '../../common/types/index.js';
import { DEFAULT_PROCESSING_CONFIG, mergeProcessingConfig } from '../../common/types/index.js';
import { getEphemeralShapeDB } from '../../services/database/EphemeralShapeDB.js';
import type { NodeId } from '@hierarchidb/common-types';
import { notify } from '@hierarchidb/components';
import { useTranslation } from '../i18n.js';

type Args = {
  config: ProcessingConfig;
  draft?: Partial<ShapeEntity> | null;
  disabled?: boolean;
  onChange: (next: ProcessingConfig) => void;
};

export const useDownloadConfigSection = ({ config, draft, disabled, onChange }: Args) => {
  const { t } = useTranslation();
  const switchId = useId();
  const baseDownloadConfig: DownloadProcessingConfig | undefined =
    config.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;

  const db = getEphemeralShapeDB();
  const sessionId = (draft as { nodeId?: NodeId })?.nodeId
    ?? (draft as { batchSessionId?: string })?.batchSessionId;
  const processingStatus = (draft as { processingStatus?: string })?.processingStatus ?? 'idle';

  const [counts, setCounts] = useState({ raw: 0, stage1: 0, stage2: 0, tiles: 0 });
  const deleteLabel = useMemo(() => (
    counts.raw > 0
      ? t('processing.download.deleteDownloadedFilesWithCount', 'Delete Downloaded Files ({{count}} files)', { count: counts.raw })
      : t('processing.download.deleteDownloadedFiles', 'Delete Downloaded Files')
  ), [counts.raw, t]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setCounts({ raw: 0, stage1: 0, stage2: 0, tiles: 0 });
      return;
    }
    const loadCounts = async () => {
      const [raw, stage1, stage2, tiles] = await Promise.all([
        db.rawBuffers.where('sessionId').equals(sessionId).count(),
        db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
        db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
        db.vectorTiles.where('sessionId').equals(sessionId).count(),
      ]);
      if (!cancelled) {
        setCounts({ raw, stage1, stage2, tiles });
      }
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [config, db, sessionId]);

  const isRunning = processingStatus === 'processing';
  const canDeleteRaw = !isRunning && counts.raw > 0 && !disabled;
  const canDeleteStage1 = !isRunning && counts.stage1 > 0 && !disabled;
  const canDeleteStage2 = !isRunning && counts.stage2 > 0 && !disabled;
  const canDeleteTiles = !isRunning && counts.tiles > 0 && !disabled;

  const handleDeleteRaw = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'download');
    const nextRaw = await db.rawBuffers.where('sessionId').equals(sessionId).count();
    setCounts((prev) => ({ ...prev, raw: nextRaw }));
    notify.success('Deleted downloaded files');
  }, [db, sessionId]);

  const handleDeleteStage = useCallback(async (stage: 'simplify1' | 'simplify2') => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, stage);
    const [next1, next2] = await Promise.all([
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify1' }).count(),
      db.simplifiedBuffers.where({ sessionId, stage: 'simplify2' }).count(),
    ]);
    setCounts((prev) => ({ ...prev, stage1: next1, stage2: next2 }));
    notify.success(stage === 'simplify1' ? 'Deleted Stage1 cache' : 'Deleted Stage2 cache');
  }, [db, sessionId]);

  const handleDeleteTiles = useCallback(async () => {
    if (!sessionId) return notify.warning('SessionId is missing.');
    await db.clearStage(sessionId, 'vectorTiles');
    const nextTiles = await db.vectorTiles.where('sessionId').equals(sessionId).count();
    setCounts((prev) => ({ ...prev, tiles: nextTiles }));
    notify.success('Deleted tiles');
  }, [db, sessionId]);

  const update = useCallback((partial: Partial<ProcessingConfig>) => {
    onChange(mergeProcessingConfig({ ...config, ...partial }));
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
