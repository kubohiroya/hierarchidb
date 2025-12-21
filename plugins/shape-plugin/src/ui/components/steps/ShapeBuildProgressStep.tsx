import { useCallback } from 'react';
import { Box, Chip, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { BuildStepPanel, type BuildStage } from '@hierarchidb/components';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeBuildProgressStep } from '../../hooks/useShapeBuildProgressStep.js';

export const ShapeBuildProgressStep: React.FC<ShapeDialogStepProps> = ({ data, onChange }) => {
  const {
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
  } = useShapeBuildProgressStep({ data, onChange });

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
              const statusLabelValue = resolveStatusLabel(statusValue);
              const statusColor = resolveStatusColor(statusValue);
              return (
                <Box key={task.taskId} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {task.taskId}
                    </Typography>
                    <Chip label={statusLabelValue} color={statusColor} size="small" variant="outlined" />
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

  return (
    <Box display="flex" flexDirection="column" gap={3} height="100%" minHeight={0}>
      <Box flex={1} minHeight={0}>
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
      </Box>
      {hasProgressData ? (
        <Paper
          variant="outlined"
          sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}
          data-testid="shape-plugin-batch-progress-summary"
        >
          <Typography variant="subtitle2">
            {t('build.progress.title', 'Batch progress')}
          </Typography>
          {data?.batchSessionId ?? data?.nodeId ? (
            <Typography variant="body2" color="text.secondary">
              {t('build.progress.session', 'Session')}: {data?.batchSessionId ?? data?.nodeId}
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
