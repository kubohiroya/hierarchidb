import { useCallback, useEffect, useMemo } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { useShapeBatchTasks } from './useShapeBatchTasks.js';
import { useShapeProgress } from './useShapeProgress.js';
import { useTranslation } from '../i18n.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  summarizeCheckboxState,
  validateProcessingConfig,
  type ShapeEntity,
} from '../../common/types/index.js';
import { useBuildStages } from './build/useBuildStages.js';
import { useBuildStatus } from './build/useBuildStatus.js';
import { useBuildTaskProgress } from '@hierarchidb/ui-batch';
import { useBatchSessionActions } from './build/useBatchSessionActions.js';

const normalizeStageId = (stage?: string): string | undefined => {
  if (!stage) return undefined;
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;

type Args = {
  data?: Partial<ShapeEntity>;
  onChange: (patch: Partial<ShapeEntity>) => void;
  nodeId?: NodeId;
};

export const useShapeBuildProgressStep = ({ data, onChange, nodeId }: Args) => {
  const { t } = useTranslation();
  const sessionId = data?.batchSessionId ?? nodeId ?? null;

  const { progress, status } = useShapeProgress(sessionId, { autoSubscribe: Boolean(sessionId) });
  const { tasks, refresh: refreshTasks } = useShapeBatchTasks(sessionId, { autoRefresh: true, pollIntervalMs: 2000 });
  const shouldForcePaused = Boolean(status?.status === 'processing' && !data?.batchSessionId);
  const stages = useBuildStages();
  const { buildStatus, statusLabel } = useBuildStatus(status, { forcePaused: shouldForcePaused });

  const currentStage = normalizeStageId(progress?.currentStage);
  const overallProgress = progress?.percentage ?? status?.progress ?? 0;
  const stageLabel = (() => {
    if (currentStage) {
      return stages.find((stage) => stage.id === currentStage)?.title
        ?? currentStage;
    }
    if (buildStatus === 'running') {
      return t('build.progress.unknownStage', 'processing');
    }
    if (buildStatus === 'paused') {
      return t('build.progress.pausedStage', 'paused');
    }
    if (buildStatus === 'completed') {
      return t('build.progress.completedStage', 'completed');
    }
    return t('build.progress.idleStage', 'idle');
  })();
  const taskLabel = (() => {
    if (buildStatus !== 'running') {
      if (status?.error) return status.error;
      if (progress?.currentTask && progress.currentTask !== 'processing' && progress.currentTask !== sessionId) {
        return progress.currentTask;
      }
      return t('build.progress.ready', 'Ready');
    }
    return progress?.currentTask
      ?? status?.error
      ?? t('build.progress.working', 'Working...');
  })();
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const failed = progress?.failed ?? 0;
  const skipped = progress?.skipped ?? 0;
  const hasProgressData = Boolean(progress) || Boolean(status && status.status !== 'idle');

  useEffect(() => {
    if (!sessionId) return;
    void refreshTasks();
  }, [refreshTasks, sessionId]);

  const { stageProgress, tasksByStage, paneProgress } = useBuildTaskProgress(
    stages,
    currentStage,
    overallProgress,
    buildStatus,
    tasks,
  );

  const resolveStatusLabel = useCallback((statusValue?: string): string => {
    switch (statusValue) {
      case 'running':
        return t('build.taskStatus.running', 'Running');
      case 'completed':
        return t('build.taskStatus.completed', 'Completed');
      case 'failed':
        return t('build.taskStatus.failed', 'Failed');
      case 'cancelled':
        return t('build.taskStatus.cancelled', 'Cancelled');
      case 'paused':
        return t('build.taskStatus.paused', 'Paused');
      case 'queued':
        return t('build.taskStatus.queued', 'Queued');
      default:
        return t('build.taskStatus.waiting', 'Waiting');
    }
  }, [t]);

  const resolveStatusColor = useCallback((statusValue?: string) => {
    switch (statusValue) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
      case 'paused':
        return 'warning';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  }, []);

  const isProcessingValid = useMemo(() => (
    validateProcessingConfig(
      mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
    ).isValid
  ), [data?.processingConfig]);
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasDataSource = Boolean(data?.dataSourceName);
  const canStartOrResume = buildStatus !== 'completed'
    && hasDataSource
    && hasSelection
    && isProcessingValid;

  const { handleStartOrResume, handlePause } = useBatchSessionActions({
    nodeType: SHAPE_NODE_TYPE,
    nodeId,
    sessionId,
    data,
    onChange,
    buildStatus,
  });

  return {
    t,
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    buildStatus,
    overallProgress,
    stageLabel,
    taskLabel,
    statusLabel,
    completed,
    total,
    failed,
    skipped,
    hasProgressData,
    canStartOrResume,
    handleStartOrResume,
    handlePause,
    resolveStatusLabel,
    resolveStatusColor,
  };
};
