import { Stack, Skeleton, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import type { PaneProgress } from '@hierarchidb/ui-lru-splitview';
import { useBuildStageFilter, type BuildStage } from '@hierarchidb/components';
import { taskScrollTargetAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import {
  TaskListVirtualized,
  sortVectorTileTasks,
  type TaskWithMetadata,
} from './TaskListVirtualized.tsx';
import { isSkippedMessage } from '../../../common/utils/taskMessages.ts';

type ShapeBuildProgressStageContentProps = {
  showHeader?: boolean;
  stage: BuildStage;
  stageValue: number;
  tasksByStage: Record<string, ShapeBuildTaskSummary[]>;
  paneProgress?: PaneProgress[];
  isTaskSummaryLoading: boolean;
  isTasksLoading: boolean;
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
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  t,
  showHeader = true,
}: ShapeBuildProgressStageContentProps) => {
  const filter = useBuildStageFilter();
  const stageTasks = tasksByStage[stage.id] ?? [];
  const scrollTarget = useAtomValue(taskScrollTargetAtom);
  const scrollToTaskId = scrollTarget?.stageId === stage.id ? scrollTarget.taskId : undefined;
  const scrollRequestId = scrollTarget?.requestedAt;
  const disableVirtualization = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).has('noTaskVirtual');
  const filteredTasks = stageTasks.filter((task) => {
    if (isSkippedMessage(task.message)) return filter.skippedMode;
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
  const showSummarySkeleton = isTaskSummaryLoading && !hasTasks && !hasSummaryTasks;
  const showTaskSkeleton = !hasTasks && !showSummarySkeleton && (isTasksLoading || hasSummaryTasks);

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
          {showHeader ? (
            <Typography variant="subtitle2">{stage.title}</Typography>
          ) : null}
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="rounded" height={160} />
        </>
      ) : !hasTasks ? (
        <>
          {showHeader ? (
            <>
              <Typography variant="subtitle2">{stage.title}</Typography>
              {stage.description ? (
                <Typography variant="body2" color="text.secondary">
                  {stage.description}
                </Typography>
              ) : null}
            </>
          ) : null}
          <Typography variant="caption" color="text.secondary">
            {hasSummaryTasks
              ? t('stage.tasks.summaryOnly', 'Tasks are summarized. Detailed list is unavailable.')
              : t('stage.tasks.empty', 'No tasks yet.')}
          </Typography>
        </>
      ) : (
        <TaskListVirtualized
          stageId={stage.id}
          tasks={displayTasks}
          stageValue={stageValue}
          resolveStatusLabel={resolveStatusLabel}
          resolveStatusColor={resolveStatusColor}
          resolveTaskTitle={resolveTaskTitle}
          scrollToTaskId={scrollToTaskId}
          scrollRequestId={scrollRequestId}
          virtualize={!disableVirtualization}
        />
      )}
    </Stack>
  );
};
