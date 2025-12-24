import { useCallback } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ConstructionIcon from '@mui/icons-material/Construction';
import { BuildStepPanel, type BuildStage } from '@hierarchidb/components';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeDialogStepProps } from './ShapeDialogStepProps.ts';
import { useShapeBuildProgressStep } from '../../hooks/useShapeBuildProgressStep.js';
import { ShapeBuildTaskItem } from './ShapeBuildTaskItem.js';

export const ShapeBuildProgressStep: React.FC<ShapeDialogStepProps> = ({ data, onChange, nodeId }) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const theme = useTheme();
  const {
    t,
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    tasks,
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
  } = useShapeBuildProgressStep({ data, onChange, nodeId: resolvedNodeId });

  type TaskWithMetadata = BatchTaskSummary & { metadata?: Record<string, unknown>; stage?: string; title?: string };

  const resolveTaskTitle = useCallback((task: TaskWithMetadata): string => {
    if (task.title) return task.title;
    const metadata = task.metadata ?? {};
    const stage = task.stage;
    if (stage === 'download') {
      const url = metadata.url as string | undefined;
      return url ?? t('build.tasks.unknown', '(Title unavailable)');
    }
    if (stage === 'simplify1') {
      const sourceUrl = (metadata.sourceUrl ?? metadata.url) as string | undefined;
      const featureId = metadata.featureId as string | undefined;
      if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
      return sourceUrl ?? featureId ?? t('build.tasks.unknown', '(Title unavailable)');
    }
    if (stage === 'simplify2') {
      const sourceUrl = (metadata.sourceUrl ?? metadata.url) as string | undefined;
      const featureId = metadata.featureId as string | undefined;
      if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
      return sourceUrl ?? featureId ?? t('build.tasks.unknown', '(Title unavailable)');
    }
    if (stage === 'vectortile' || stage === 'vectorTiles') {
      const minZoom = metadata.minZoom as number | undefined;
      const maxZoom = metadata.maxZoom as number | undefined;
      const tileX = metadata.tileX as number | undefined;
      const tileY = metadata.tileY as number | undefined;
      if (typeof tileX === 'number' && typeof tileY === 'number') {
        if (typeof minZoom === 'number' && typeof maxZoom === 'number') {
          return `z${minZoom}-${maxZoom} / x${tileX} y${tileY}`;
        }
        return `x${tileX} y${tileY}`;
      }
      if (typeof minZoom === 'number' && typeof maxZoom === 'number') {
        return `z${minZoom}-${maxZoom}`;
      }
    }
    return t('build.tasks.unknown', '(Title unavailable)');
  }, [t]);

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
              const taskTitle = resolveTaskTitle(task as TaskWithMetadata);
              const taskMessage = task.message && task.message !== taskTitle ? task.message : undefined;
              return (
                <ShapeBuildTaskItem
                  key={task.taskId}
                  title={taskTitle}
                  statusLabel={statusLabelValue}
                  statusColor={statusColor}
                  message={taskMessage}
                  progress={task.progress}
                  fallbackProgress={stageValue}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    );
  }, [resolveStatusColor, resolveStatusLabel, resolveTaskTitle, t, tasksByStage]);

  const renderTaskProgressBar = useCallback(() => {
    const totalTasks = tasks.length || total;
    if (totalTasks <= 0) {
      return (
        <Box sx={{ height: 10, borderRadius: 1, backgroundColor: theme.palette.action.hover }} />
      );
    }
    const viewWidth = totalTasks;
    const rectHeight = 10;
    const colorForTask = (task: BatchTaskSummary): string => {
      if (task.status === 'completed') return theme.palette.success.main;
      if (task.status === 'failed') return theme.palette.error.main;
      return theme.palette.grey[400];
    };
    return (
      <Box sx={{ width: '100%', height: rectHeight }}>
        <svg width="100%" height={rectHeight} viewBox={`0 0 ${viewWidth} 1`} preserveAspectRatio="none">
          <title>---progress---</title>
          {Array.from<number>({ length: totalTasks }).map((_item: number, index: number)=>index).map((index) => {
            const task = tasks[index];
            const fill = task ? colorForTask(task) : theme.palette.grey[400];
            return (
              <rect
                key={`task-${index}`}
                x={index}
                y={0}
                width={1}
                height={1}
                fill={fill}
              />
            );
          })}
        </svg>
      </Box>
    );
  }, [tasks, theme, total]);

  const BatchProgressSummaryCard = useCallback(() => (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        transition: 'none',
        '&:hover': { transform: 'none', boxShadow: 'none' },
      }}
      data-testid="shape-plugin-batch-progress-summary"
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack spacing={0.25} flex={1}>
            <Typography variant="caption" color="text.secondary">
              {t('build.progress.stage', 'Stage')}
            </Typography>
            <Typography variant="body2">{stageLabel}</Typography>
          </Stack>
          <Stack spacing={0.25} flex={1}>
            <Typography variant="caption" color="text.secondary">
              {t('build.progress.task', 'Task')}
            </Typography>
            <Typography variant="body2">{taskLabel}</Typography>
          </Stack>
        </Stack>
        <Stack gap={1}>
          {renderTaskProgressBar()}
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
      </CardContent>
    </Card>
  ), [completed, failed, overallProgress, renderTaskProgressBar, skipped, stageLabel, t, taskLabel, total]);

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
          statusContent={hasProgressData ? <BatchProgressSummaryCard /> : undefined}
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
    </Box>
  );
};
