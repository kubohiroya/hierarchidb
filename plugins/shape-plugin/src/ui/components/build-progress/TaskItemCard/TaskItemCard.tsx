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
  const isSkipped = isTaskSkipped(task.display);
  const displayProgress = Math.min(100, Math.max(0, task.progress ?? stageValue));
  const statusLabelValue = resolveStatusLabel(statusValue, isSkipped);
  const statusColor = resolveStatusColor(statusValue, isSkipped);
  const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
  const displayMessage = formatTaskDisplayMessage(task.display, translate);
  const errorMessage = typeof task.errorMessage === 'string' ? task.errorMessage.trim() : '';
  const fallbackError = typeof task.error === 'string' ? task.error.trim() : '';
  const failedMessage = errorMessage || fallbackError;
  const geometrySourceMessage = failedMessage || undefined;
  const geometryDetails = parseGeometrySimplifyError(geometrySourceMessage);
  const geometryBaseMessage = geometrySourceMessage?.split(' (')[0];
  const readNumberFromMetadata = (rawValue: unknown): number | null => {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return rawValue;
    }
    if (typeof rawValue === 'string') {
      const parsed = Number.parseFloat(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const stripMetadataSuffixFromMessage = (message?: string): string | undefined => {
    if (!message) return undefined;
    const trimmed = message.trim();
    if (!trimmed) return undefined;
    return geometryDetails ? trimmed.split(' (')[0] : trimmed;
  };
  const formatToleranceValue = (value: number): string => (
    Number.isFinite(value) ? `${Number.parseFloat(value.toFixed(6))}` : '-'
  );
  const metadataEffectiveTolerance = (() => {
    const rawTolerance = readNumberFromMetadata(task.metadata?.effectiveTolerance);
    if (rawTolerance === null) return '-';
    return formatToleranceValue(rawTolerance);
  })();
  const resolvedRetryAttempt = (() => {
    const rawRetryAttempt = readNumberFromMetadata(task.retryAttempt ?? task.metadata?.retryAttempt);
    if (rawRetryAttempt === null) return null;
    const rounded = Math.floor(rawRetryAttempt);
    return rounded >= 0 ? rounded : null;
  })();
  const messageSourceText = task.status === 'failed'
    ? failedMessage || displayMessage || geometryBaseMessage
    : displayMessage || geometryBaseMessage;
  const messageText = stripMetadataSuffixFromMessage(messageSourceText) ?? taskTitle;
  const resolvedRetryAttemptText = resolvedRetryAttempt === null ? '-' : `${resolvedRetryAttempt}`;
  const transformMessageSuffix = stageId === 'transform'
    ? ` (effectiveTolerance=${metadataEffectiveTolerance} retryAttempt=${resolvedRetryAttemptText})`
    : '';
  const taskMessage = transformMessageSuffix
    ? `${messageText}${transformMessageSuffix}`
    : messageText;
  const detailLines = task.status === 'failed'
    ? (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined)
    : (displayMessage ? undefined : (geometryDetails ? formatGeometrySimplifySummary(geometryDetails) : undefined));
  const normalizedRetryAttempt = resolvedRetryAttempt !== null && resolvedRetryAttempt >= 0
    ? resolvedRetryAttempt
    : null;
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
      message={taskMessage}
      detailLines={detailLines}
      progress={displayProgress}
      fallbackProgress={stageValue}
    />
  );
};
