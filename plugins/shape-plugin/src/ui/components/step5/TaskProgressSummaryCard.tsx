import { Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import { TaskProgressBar } from './TaskProgressBar.tsx';
import type { TaskProgressSummary } from '../../atoms/shapeBuildProgressAtoms.ts';
import type { BuildStage } from '@hierarchidb/components';
import type { TaskWithMetadata } from './TaskListVirtualized.tsx';
import { useTranslation } from '@hierarchidb/ui-i18n';

type TaskProgressSummaryCardProps = {
  summary: TaskProgressSummary;
  stages: BuildStage[];
  tasksByStage: Record<string, TaskWithMetadata[]>;
};

export const TaskProgressSummaryCard = ({
                                    summary,
                                    stages,
                                    tasksByStage
                                  }: TaskProgressSummaryCardProps) => {
  const { t } = useTranslation();
  return (
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
              {t('stage.progress.stage', 'Stage')}
            </Typography>
            <Typography variant="body2">{summary.stageLabel}</Typography>
          </Stack>
          <Stack spacing={0.25} flex={1}>
            <Typography variant="caption" color="text.secondary">
              {summary.taskUnitLabel || t('stage.progress.task', 'Polygons')}
            </Typography>
            <Typography variant="body2">{summary.taskLabel}</Typography>
          </Stack>
        </Stack>
        <Stack gap={1}>
          <TaskProgressBar
            stages={stages}
            tasksByStage={tasksByStage}
            buildStatus={summary.buildStatus}
          />
          <LinearProgress
            variant="indeterminate"
            sx={{
              height: 6,
              borderRadius: 6,
              visibility: summary.buildStatus === 'running' ? 'visible' : 'hidden',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('stage.progress.countsWithUnit', '{{percentage}}% ・ {{completed}}/{{total}} {{unit}} completed ・ failed {{failed}} ・ skipped {{skipped}}', {
              percentage: Math.round(summary.overallProgress),
              completed: summary.completed,
              total: summary.total,
              failed: summary.failed,
              skipped: summary.skipped,
              unit: summary.taskUnitLabel || t('stage.progress.task', 'Polygons'),
            })}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
