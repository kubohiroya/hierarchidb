import { Stack, Skeleton, Typography } from '@mui/material';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { useBuildStageFilter, type BuildStage } from '@hierarchidb/components';
import {
  TaskListVirtualized,
  sortVectorTileTasks,
  type TaskWithMetadata,
} from './TaskListVirtualized.tsx';

type ShapeBuildProgressStageContentProps = {
  stage: BuildStage;
  stageValue: number;
  tasksByStage: Record<string, BatchTaskSummary[]>;
  paneProgress?: PaneProgress[];
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
  buildStatus: string;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskWithMetadata) => string;
  t: (key: string, fallback: string) => string;
};

export const ShapeBuildProgressStageContent = ({
  stage,
  stageValue,
  tasksByStage,
  paneProgress,
  isTaskSummaryLoading,
  isTasksLoading,
  buildStatus,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
}: ShapeBuildProgressStageContentProps) => {
  const filter = useBuildStageFilter();
  const stageTasks = tasksByStage[stage.id] ?? [];
  const filteredTasks = stageTasks.filter((task) => {
    if (task.status === 'failed') return filter.failedMode;
    if (task.status === 'completed') return filter.completedMode;
    return true;
  });
  const displayTasks = stage.id === 'vt'
    ? sortVectorTileTasks(filteredTasks)
    : filteredTasks;
  const hasTasks = filteredTasks.length > 0;
  const stagePane = paneProgress?.find((entry) => entry.paneId === stage.id);
  const hasSummaryTasks = (stagePane?.taskCount ?? 0) > 0;
  const isBuildRunning = buildStatus === 'running';
  const showSummarySkeleton = isBuildRunning && isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = isBuildRunning && !hasTasks && !showSummarySkeleton && (isTasksLoading || hasSummaryTasks);

  return (
    <Stack spacing={1} sx={{ p: 2, height: '100%', minHeight: 0 }}>
      {showSummarySkeleton ? (
        <>
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="rounded" height={88} />
        </>
      ) : showTaskSkeleton ? (
        <>
          <Typography variant="subtitle2">{stage.title}</Typography>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="rounded" height={160} />
        </>
      ) : !hasTasks ? (
        <>
          <Typography variant="subtitle2">{stage.title}</Typography>
          {stage.description ? (
            <Typography variant="body2" color="text.secondary">
              {stage.description}
            </Typography>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {hasSummaryTasks
              ? t('stage.tasks.summaryOnly', 'Tasks are summarized. Detailed list is unavailable.')
              : t('stage.tasks.empty', 'No tasks yet.')}
          </Typography>
        </>
      ) : (
        <TaskListVirtualized
          tasks={displayTasks}
          stageValue={stageValue}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
        />
      )}
    </Stack>
  );
};
