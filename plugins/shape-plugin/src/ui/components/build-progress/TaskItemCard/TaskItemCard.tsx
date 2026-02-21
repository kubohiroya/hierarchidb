import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import RecyclingIcon from '@mui/icons-material/Recycling';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import { formatGeometrySimplifySummary, parseGeometrySimplifyError } from '~/ui/components/build-progress/geometrySimplifyError';
import { formatTaskDisplayMessage } from '~/ui/components/build-progress/taskDisplayText';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { TaskItem } from '~/ui/components/build-progress/TaskItem/TaskItem';

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
}: TaskItemCardProps) => {
  const statusValue = task.status;
  const isSkipped = isTaskSkipped(task.display, task.message);
  const displayProgress = Math.min(100, Math.max(0, task.progress ?? stageValue));
  const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
  const statusColor = resolveStatusColor(statusValue, isSkipped);
  const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
  const displayMessage = formatTaskDisplayMessage(task.display, translate);
  const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
  const fallbackError = typeof task.error === 'string' ? task.error.trim() : '';
  const failedMessage = errorMessage || fallbackError;
  const geometryDetails = parseGeometrySimplifyError(task.message);
  const baseMessage = task.message?.split(' (')[0];
  const taskMessage = task.status === 'failed'
    ? (
      failedMessage
      || (task.message && task.message !== taskTitle
        ? (geometryDetails ? baseMessage : task.message)
        : undefined)
    )
    : (
      displayMessage
      ?? (task.message && task.message !== taskTitle
        ? (geometryDetails ? baseMessage : task.message)
        : undefined)
    );
  const detailLines = task.status === 'failed'
    ? (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined)
    : (displayMessage ? undefined : (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined));
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
      statusLabel={statusLabelValue}
      statusColor={statusColor}
      isRunning={task.status === 'running'}
      message={taskMessage}
      detailLines={detailLines}
      progress={displayProgress}
      fallbackProgress={stageValue}
    />
  );
};
