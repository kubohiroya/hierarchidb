import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import RecyclingIcon from '@mui/icons-material/Recycling';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { TaskItem, type TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';
import {
  type TaskOutcomeSummaryBuilder,
  buildFetchTaskOutcomeSummary,
  buildSimpleTaskOutcomeSummary,
  buildTransformTaskOutcomeSummary,
} from './taskOutcomeSummaryBuilders';

type Translate = (key: string, fallback?: string) => string;

type TaskItemCardProps = {
  task: ShapeBuildTaskSummary;
  stageId: string;
  stageValue: number;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  stageIcon?: ReactNode | null;
  translate: Translate;
  summaryBuilder?: TaskOutcomeSummaryBuilder;
  onDetailHoverChange?: (value: { title: string; summary: TaskOutcomeSummary } | null) => void;
};

const resolveRetryAttemptFromTask = (task: ShapeBuildTaskSummary): number | null => {
  const rawValue = task.retryAttempt ?? task.metadata?.retryAttempt ?? task.metadata?.retries ?? task.metadata?.attempts;
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return null;
  }
  const rounded = Math.floor(rawValue);
  return rounded >= 0 ? rounded : null;
};

export const TaskItemCard = ({
  task,
  stageId,
  stageValue,
  resolveStatusLabel,
  resolveStatusColor,
  resolveTaskTitle,
  stageIcon,
  translate,
  summaryBuilder,
  onDetailHoverChange,
}: TaskItemCardProps) => {
  const statusValue = task.status;
  const skipped = isTaskSkipped(task.display);
  const displayProgress = Math.min(100, Math.max(0, task.progress ?? stageValue));
  const statusLabelValue = resolveStatusLabel(statusValue, skipped);
  const statusColor = resolveStatusColor(statusValue, skipped);
  const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);

  const builder = summaryBuilder
    ?? (
      stageId === 'transform'
        ? buildTransformTaskOutcomeSummary
        : (stageId === 'fetch' ? buildFetchTaskOutcomeSummary : buildSimpleTaskOutcomeSummary)
    );
  const summary = builder({
    task,
    stageId,
    taskTitle,
    translate,
  });

  const normalizedRetryAttempt = resolveRetryAttemptFromTask(task);
  const normalizedStatusLabel = statusLabelValue.replace(/\s*\(line\s+\d+\)\s*$/i, '');
  const statusLabel = stageId === 'transform'
    && normalizedRetryAttempt !== null
    && (task.status === 'completed' || task.status === 'failed')
    ? (normalizedRetryAttempt > 0 ? `(Retry ${normalizedRetryAttempt})` : `(${normalizedStatusLabel})`)
    : statusLabelValue;

  let leadingIcon: ReactNode = null;
  if (task.status === 'recycled') {
    leadingIcon = (
      <RecyclingIcon data-testid="task-icon-recycling" sx={{ fontSize: 16, color: 'text.secondary' }} />
    );
  } else if (stageIcon) {
    leadingIcon = (
      <Box
        data-testid={`task-icon-stage-${stageId}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          '& .MuiSvgIcon-root': {
            fontSize: 16,
          },
        }}
      >
        {stageIcon}
      </Box>
    );
  }

  return (
    <TaskItem
      title={taskTitle}
      leadingIcon={leadingIcon}
      statusLabel={statusLabel}
      statusColor={statusColor}
      isRunning={task.status === 'running'}
      summary={summary}
      progress={displayProgress}
      fallbackProgress={stageValue}
      onDetailHoverChange={onDetailHoverChange}
    />
  );
};
