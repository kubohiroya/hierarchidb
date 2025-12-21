import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { BuildStepPanel, type BuildStage, type BuildStatus } from '@hierarchidb/components';
import type { NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { notify } from '@hierarchidb/components';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { useTranslation } from '../../i18n.js';
import { useShapeBatchTasks } from '../../hooks/useShapeBatchTasks.js';
import { useShapeProgress } from '../../hooks/useShapeProgress.js';
import {
  DEFAULT_PROCESSING_CONFIG,
  mergeProcessingConfig,
  summarizeCheckboxState,
  validateProcessingConfig,
} from '../../../common/types/index.js';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';

const normalizeStageId = (stage?: string): string | undefined => {
  if (!stage) return undefined;
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const toStageKey = (stage?: string): string => {
  if (!stage) return 'download';
  if (stage === 'vectortile') return 'vectorTiles';
  return stage;
};

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export const ShapeBuildProgressStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const { t } = useTranslation();
  const nodeId = data?.nodeId;
  const sessionId = data?.batchSessionId ?? nodeId ?? null;
  const bridgeRef = useRef(getWorkerBridge());
  const workerClientHook = useMemo(() => {
    try {
      return getWorkerClientHook<WorkerClientRef | null>();
    } catch {
      return null;
    }
  }, []);
  const workerClient = workerClientHook ? workerClientHook() : null;

  const { progress, status } = useShapeProgress(sessionId, { autoSubscribe: Boolean(sessionId) });
  const { tasks, refresh: refreshTasks } = useShapeBatchTasks(sessionId, { autoRefresh: true, pollIntervalMs: 2000 });
  const shouldForcePaused = Boolean(status?.status === 'processing' && !data?.batchSessionId);
  const effectiveStatus = shouldForcePaused && status
    ? { ...status, status: 'paused' as const }
    : status;

  const stages = useMemo<BuildStage[]>(() => ([
    {
      id: 'download',
      title: t('build.stages.download.title', 'Download'),
      description: t('build.stages.download.description', 'Download and normalize source data.'),
    },
    {
      id: 'simplify1',
      title: t('build.stages.simplify1.title', 'Simplify (Stage 1)'),
      description: t('build.stages.simplify1.description', 'Apply primary simplification for selections.'),
    },
    {
      id: 'simplify2',
      title: t('build.stages.simplify2.title', 'Simplify (Stage 2)'),
      description: t('build.stages.simplify2.description', 'Prepare simplified buffers for tile generation.'),
    },
    {
      id: 'vectorTiles',
      title: t('build.stages.vectorTiles.title', 'Vector Tiles'),
      description: t('build.stages.vectorTiles.description', 'Generate vector tiles for the selected zoom range.'),
    },
  ]), [t]);

  const currentStage = normalizeStageId(progress?.currentStage);
  const overallProgress = progress?.percentage ?? status?.progress ?? 0;
  const stageLabel = stages.find((stage) => stage.id === currentStage)?.title
    ?? currentStage
    ?? t('build.progress.unknownStage', 'processing');
  const taskLabel = progress?.currentTask
    ?? status?.error
    ?? t('build.progress.working', 'Working...');
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const failed = progress?.failed ?? 0;
  const skipped = progress?.skipped ?? 0;
  const hasProgressData = Boolean(progress || status);

  useEffect(() => {
    if (!sessionId) return;
    void refreshTasks();
  }, [progress?.timestamp, refreshTasks, sessionId, status?.status]);

  const buildStatus: BuildStatus = (() => {
    switch (effectiveStatus?.status) {
      case 'processing':
        return 'running';
      case 'paused':
        return 'paused';
      case 'completed':
        return 'completed';
      default:
        return 'idle';
    }
  })();

  const statusLabel = (() => {
    switch (effectiveStatus?.status) {
      case 'processing':
        return t('build.status.running', 'Build in progress');
      case 'paused':
        return t('build.status.paused', 'Build paused');
      case 'completed':
        return t('build.status.completed', 'Build completed');
      case 'failed':
        return t('build.status.failed', 'Build failed');
      case 'cancelled':
        return t('build.status.cancelled', 'Build cancelled');
      default:
        return t('build.status.ready', 'Ready to start build');
    }
  })();

  const stageProgress = useMemo(() => {
    const map: Record<string, number> = {};
    if (buildStatus === 'completed') {
      stages.forEach((stage) => {
        map[stage.id] = 100;
      });
      return map;
    }
    const stageIndex = stages.findIndex((stage) => stage.id === currentStage);
    stages.forEach((stage, idx) => {
      if (stageIndex < 0) {
        map[stage.id] = 0;
      } else if (idx < stageIndex) {
        map[stage.id] = 100;
      } else if (idx === stageIndex) {
        map[stage.id] = Math.min(100, Math.max(0, overallProgress));
      } else {
        map[stage.id] = 0;
      }
    });
    return map;
  }, [buildStatus, currentStage, overallProgress, stages]);

  const tasksByStage = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {};
    tasks.forEach((task) => {
      const key = toStageKey(task.stage);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }, [tasks]);

  const paneProgress = useMemo(() => {
    return stages.map((stage) => {
      const stageTasks = tasksByStage[stage.id] ?? [];
      const taskCount = stageTasks.length;
      const completedCount = stageTasks.filter((task) => task.status === 'completed').length;
      const progressValue = taskCount > 0
        ? Math.round(stageTasks.reduce((sum, task) => sum + (task.progress ?? 0), 0) / taskCount)
        : (stageProgress[stage.id] ?? overallProgress);
      return {
        paneId: stage.id,
        progress: Math.min(100, Math.max(0, progressValue)),
        taskCount,
        completedCount,
        status: buildStatus,
      };
    });
  }, [buildStatus, overallProgress, stageProgress, stages, tasksByStage]);

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

  const renderStageContent = useCallback((stage: BuildStage, stageValue: number) => {
    const stageTasks = tasksByStage[stage.id] ?? [];
    return (
      <Stack spacing={1} sx={{ p: 2 }}>
        <Typography variant="subtitle2">{stage.title}</Typography>
        {stage.description ? (
          <Typography variant="body2" color="text.secondary">
            {stage.description}
          </Typography>
        ) : null}
        {stageTasks.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            {t('build.tasks.empty', 'No tasks yet.')}
          </Typography>
        ) : (
          <Stack spacing={1}>
            {stageTasks.map((task) => {
              const statusValue = task.status;
              const statusLabel = resolveStatusLabel(statusValue);
              const statusColor = resolveStatusColor(statusValue);
              return (
                <Box key={task.taskId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {task.taskId}
                    </Typography>
                    <Chip label={statusLabel} color={statusColor} size="small" variant="outlined" />
                  </Stack>
                  {task.message ? (
                    <Typography variant="caption" color="text.secondary">
                      {task.message}
                    </Typography>
                  ) : null}
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, task.progress ?? stageValue))}
                    color={statusColor === 'default' ? 'primary' : statusColor}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>
    );
  }, [resolveStatusColor, resolveStatusLabel, t, tasksByStage]);

  const isProcessingValid = useMemo(() => (
    validateProcessingConfig(
      mergeProcessingConfig(data?.processingConfig ?? DEFAULT_PROCESSING_CONFIG),
    ).isValid
  ), [data?.processingConfig]);
  const hasSelection = summarizeCheckboxState(data?.checkboxState).hasSelection;
  const hasDataSource = Boolean(data?.dataSourceName);
  const canStartOrResume = Boolean(nodeId)
    && buildStatus !== 'completed'
    && hasDataSource
    && hasSelection
    && isProcessingValid;

  const saveDraftBeforeBatch = useCallback(async () => {
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return false;
    }
    if (!workerClient) {
      notify.error('Worker client is unavailable.');
      return false;
    }
    try {
      const api = workerClient.getAPI();
      const updater = await api.getTreeNodeUpdaterAPI();
      await updater.updateTreeNode(nodeId, {
        mode: 'save-draft',
        draftData: (data ?? {}) as Record<string, unknown>,
      });
      return true;
    } catch (error) {
      notify.error('Failed to save draft.');
      console.error('[ShapeBuildProgressStep] save draft failed', error);
      return false;
    }
  }, [data, nodeId, workerClient]);

  const handleStartOrResume = useCallback(async () => {
    if (!nodeId) {
      notify.warning('NodeId is missing.');
      return;
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) return;
    try {
      await bridgeRef.current.initialize();
      if (buildStatus === 'paused' && sessionId) {
        await bridgeRef.current.resumeBatchSession(SHAPE_NODE_TYPE, sessionId);
        return;
      }
      const statusResult = await bridgeRef.current.startBatchSession(SHAPE_NODE_TYPE, nodeId);
      if (statusResult?.sessionId) {
        onChange({ batchSessionId: statusResult.sessionId });
      }
    } catch (error) {
      notify.error('Failed to start or resume build.');
      console.error('[ShapeBuildProgressStep] start/resume failed', error);
    }
  }, [buildStatus, nodeId, onChange, saveDraftBeforeBatch, sessionId]);

  const handlePause = useCallback(async () => {
    if (!sessionId) {
      notify.warning('SessionId is missing.');
      return;
    }
    const saved = await saveDraftBeforeBatch();
    if (!saved) return;
    try {
      await bridgeRef.current.initialize();
      await bridgeRef.current.pauseBatchSession(SHAPE_NODE_TYPE, sessionId);
    } catch (error) {
      notify.error('Failed to pause build.');
      console.error('[ShapeBuildProgressStep] pause failed', error);
    }
  }, [saveDraftBeforeBatch, sessionId]);

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <BuildStepPanel
        status={buildStatus}
        overallProgress={overallProgress}
        stages={stages}
        stageProgress={stageProgress}
        paneProgress={paneProgress}
        renderStageContent={renderStageContent}
        startIcon={<ConstructionIcon fontSize="small" />}
        onPause={handlePause}
        onResume={canStartOrResume ? handleStartOrResume : undefined}
        controlLabel={t('build.controls.title', 'Build controls')}
        pauseLabel={t('build.controls.pause', 'Pause')}
        startLabel={t('build.controls.start', 'Start build')}
        resumeLabel={t('build.controls.resume', 'Resume build')}
        statusLabel={statusLabel}
      />
      {hasProgressData ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid="shape-plugin-batch-progress-summary"
        >
          <Typography variant="subtitle2">
            {t('build.progress.title', 'Batch progress')}
          </Typography>
          {sessionId ? (
            <Typography variant="body2" color="text.secondary">
              {t('build.progress.session', 'Session')}: {sessionId}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t('build.progress.stage', 'Stage')}: {stageLabel}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('build.progress.task', 'Task')}: {taskLabel}
          </Typography>
          <Stack spacing={0.5}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, overallProgress))}
              sx={{ height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('build.progress.counts', '{{percentage}}% ・ {{completed}}/{{total}} completed ・ failed {{failed}} ・ skipped {{skipped}}', {
                percentage: Math.round(overallProgress),
                completed,
                total,
                failed,
                skipped,
              })}
            </Typography>
          </Stack>
        </Paper>
      ) : null}
    </Box>
  );
};
