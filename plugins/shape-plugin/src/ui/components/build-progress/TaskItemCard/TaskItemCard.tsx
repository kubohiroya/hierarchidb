import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import { FlagOverlay } from '@hierarchidb/ui-flag-overlay';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { isTaskSkipped } from '~/common/utils/taskMessages';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import { TaskItem, type TaskOutcomeSummary } from '~/ui/components/build-progress/TaskItem/TaskItem';
import {
  type TaskOutcomeSummaryBuilder,
  buildSourceTaskOutcomeSummary,
  buildSimpleTaskOutcomeSummary,
  buildGeometryTaskOutcomeSummary,
} from './taskOutcomeSummaryBuilders';
import {
  isGeometryLikeStageId,
  isTileEmitLikeStageId,
} from '~/ui/components/build-progress/stageIdAliases';

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
  isDetailSelected?: boolean;
  isDetailHoverPreviewActive?: boolean;
  onDetailHoverChange?: (value: { title: string; summary: TaskOutcomeSummary; task: ShapeBuildTaskSummary } | null) => void;
  onDetailClick?: (value: { title: string; summary: TaskOutcomeSummary; task: ShapeBuildTaskSummary }) => void;
};

const resolveRetryAttemptFromTask = (task: ShapeBuildTaskSummary): number | null => {
  const rawValue = task.retryAttempt ?? task.metadata?.retryAttempt ?? task.metadata?.retries ?? task.metadata?.attempts;
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return null;
  }
  const rounded = Math.floor(rawValue);
  return rounded >= 0 ? rounded : null;
};

const readString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const resolveCountryCodeFromTask = (task: ShapeBuildTaskSummary, taskTitle: string): string | null => {
  const metadata = (task.metadata && typeof task.metadata === 'object')
    ? task.metadata as Record<string, unknown>
    : null;
  const fetchDetail = (metadata?.fetchDetail && typeof metadata.fetchDetail === 'object')
    ? metadata.fetchDetail as Record<string, unknown>
    : null;
  const preview = (metadata?.preview && typeof metadata.preview === 'object')
    ? metadata.preview as Record<string, unknown>
    : null;
  const candidates = [
    readString(fetchDetail?.countryCode),
    readString(preview?.sourceCountryCode),
    readString(preview?.countryCode),
  ];
  for (const candidate of candidates) {
    if (candidate && /^[A-Za-z]{2}$/.test(candidate)) return candidate.toUpperCase();
  }
  const titleMatch = taskTitle.match(/\(([A-Za-z]{2})\)/);
  if (titleMatch?.[1]) return titleMatch[1].toUpperCase();
  const taskIdMatch = task.taskId.match(/:([A-Za-z]{2}):\d+$/);
  if (taskIdMatch?.[1]) return taskIdMatch[1].toUpperCase();
  return null;
};

const toFlagEmoji = (countryCode: string | null): string | null => {
  if (!countryCode) return null;
  if (!/^[A-Z]{2}$/.test(countryCode)) return null;
  const base = 0x1f1e6;
  const first = countryCode.charCodeAt(0) - 65 + base;
  const second = countryCode.charCodeAt(1) - 65 + base;
  return String.fromCodePoint(first, second);
};

const resolveTileEmitTopCountryCodes = (task: ShapeBuildTaskSummary): string[] => {
  if (!isTileEmitLikeStageId(task.stage)) return [];
  const metadata = (task.metadata && typeof task.metadata === 'object')
    ? task.metadata as Record<string, unknown>
    : null;
  const summary = (metadata?.tileEmitParentInputSummary && typeof metadata.tileEmitParentInputSummary === 'object')
    ? metadata.tileEmitParentInputSummary as Record<string, unknown>
    : null;
  const rows = Array.isArray(summary?.topCountriesByIntersectingArea)
    ? summary.topCountriesByIntersectingArea as unknown[]
    : [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const code = (row as Record<string, unknown>).countryCode;
      return typeof code === 'string' ? code.trim().toUpperCase() : null;
    })
    .filter((value): value is string => Boolean(value && /^[A-Z]{2}$/.test(value)))
    .slice(0, 2);
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
  isDetailSelected = false,
  isDetailHoverPreviewActive = false,
  onDetailHoverChange,
  onDetailClick,
}: TaskItemCardProps) => {
  const statusValue = task.status;
  const skipped = isTaskSkipped(task.display);
  const displayProgress = Math.min(100, Math.max(0, task.progress ?? stageValue));
  const statusLabelValue = resolveStatusLabel(statusValue, skipped);
  const statusColor = resolveStatusColor(statusValue, skipped);
  const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
  const builder = summaryBuilder
    ?? (
      isGeometryLikeStageId(stageId)
        ? buildGeometryTaskOutcomeSummary
        : (isTileEmitLikeStageId(stageId) ? buildSimpleTaskOutcomeSummary : buildSourceTaskOutcomeSummary)
    );
  const summary = builder({
    task,
    stageId,
    taskTitle,
    translate,
  });

  const normalizedRetryAttempt = resolveRetryAttemptFromTask(task);
  const statusLabel = isGeometryLikeStageId(stageId)
    && (task.status === 'completed' || task.status === 'failed')
    ? (
      normalizedRetryAttempt !== null && normalizedRetryAttempt > 0
        ? `${task.status === 'failed' ? 'Failed' : 'Completed'}: retry ${normalizedRetryAttempt}`
        : (task.status === 'failed' ? 'Failed' : 'Completed')
    )
    : statusLabelValue;

  const countryCode = resolveCountryCodeFromTask(task, taskTitle);
  const flag = toFlagEmoji(countryCode);
  const tileEmitTopCountryCodes = resolveTileEmitTopCountryCodes(task);
  const leadingIcon: ReactNode = tileEmitTopCountryCodes.length > 0
    ? (
      <Box
        data-testid="task-icon-tileEmit-flag-overlay"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 16,
          opacity: task.status === 'recycled' ? 0.5 : 1,
        }}
      >
        <FlagOverlay
          width={29}
          height={21}
          defaultFlagSize={17}
          items={tileEmitTopCountryCodes.map((isoCode, index) => ({
            isoCode,
            x: index === 0 ? 0 : 9,
            y: index === 0 ? 0 : 3,
          }))}
        />
      </Box>
    )
    : flag
      ? (
      <Box
        data-testid="task-icon-flag"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          width: 18,
          opacity: task.status === 'recycled' ? 0.5 : 1,
        }}
      >
        <span title={countryCode ?? 'country-flag'}>{flag}</span>
      </Box>
      )
      : (stageIcon ?? null);

  return (
    <TaskItem
      task={task}
      title={taskTitle}
      leadingIcon={leadingIcon}
      statusLabel={statusLabel}
      statusColor={statusColor}
      isRunning={task.status === 'running'}
      summary={summary}
      progress={displayProgress}
      fallbackProgress={stageValue}
      isDetailSelected={isDetailSelected}
      isDetailHoverPreviewActive={isDetailHoverPreviewActive}
      onDetailHoverChange={onDetailHoverChange}
      onDetailClick={onDetailClick}
    />
  );
};
