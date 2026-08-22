import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import type React from 'react';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import { TASK_ITEM_HEIGHT } from './TASK_ITEM_HEIGHT.ts';

type TaskMetric = {
  input: number | null;
  output: number | null;
};

export type TaskOutcomeSummary = {
  kind: 'completed' | 'failed' | 'skipped' | 'other';
  visualization?: 'none' | 'transformMetrics' | 'fetchMetrics';
  adminLevel?: number | null;
  summaryLine: string;
  detailLines?: string[];
  baseTolerance?: number | null;
  initialTolerance?: number | null;
  effectiveTolerance?: number | null;
  retryAttempt?: number | null;
  retryMax?: number | null;
  vertexReductionRate?: number | null;
  metrics?: {
    features: TaskMetric;
    polygons: TaskMetric;
    vertices: TaskMetric;
  };
  sourceMetrics?: {
    features: TaskMetric;
    polygons: TaskMetric;
  };
  maxPolygonVertices?: TaskMetric;
  vertexLimit?: number | null;
  fetchDetails?: {
    countryName: string | null;
    countryCode: string | null;
    adminLevel: number | null;
    url: string | null;
    features: TaskMetric;
    polygons: TaskMetric;
  };
};

type Props = {
  task: ShapeBuildTaskSummary;
  title: string;
  leadingIcon?: React.ReactNode;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  isWarningResult?: boolean;
  isRunning?: boolean;
  summary?: TaskOutcomeSummary;
  progress?: number;
  fallbackProgress: number;
  isDetailSelected?: boolean;
  isDetailHoverPreviewActive?: boolean;
  onDetailHoverChange?: (
    value: { title: string; summary: TaskOutcomeSummary; task: ShapeBuildTaskSummary } | null
  ) => void;
  onDetailClick?: (value: {
    title: string;
    summary: TaskOutcomeSummary;
    task: ShapeBuildTaskSummary;
  }) => void;
};

export const TaskItemView: React.FC<Props> = ({
  task,
  title,
  leadingIcon,
  statusLabel,
  statusColor,
  isWarningResult = false,
  isRunning = false,
  summary,
  progress,
  fallbackProgress,
  isDetailSelected = false,
  isDetailHoverPreviewActive = false,
  onDetailHoverChange,
  onDetailClick,
}) => {
  const displayMessage = summary?.summaryLine ?? '';
  const progressValue = Math.min(100, Math.max(0, progress ?? fallbackProgress));
  const showRunningOverlay = isRunning && progressValue < 100;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: `${TASK_ITEM_HEIGHT}px`,
        minHeight: `${TASK_ITEM_HEIGHT}px`,
        maxHeight: `${TASK_ITEM_HEIGHT}px`,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: '2px', minHeight: 24 }}>
          {leadingIcon ? (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
                minHeight: 20,
              }}
            >
              {leadingIcon}
            </Box>
          ) : null}
          <Typography
            variant="caption"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minHeight: 20,
              fontSize: '14px',
              lineHeight: 1.25,
            }}
          >
            {title}
          </Typography>
          <Chip
            label={
              isWarningResult ? (
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Box component="span" data-testid="task-warning-icon" aria-label="warning">
                    ⚠
                  </Box>
                  {statusLabel}
                </Box>
              ) : (
                statusLabel
              )
            }
            color={statusColor}
            size="small"
            variant="outlined"
            sx={(theme) => {
              const selectedStyle = (() => {
                if (!isDetailSelected) return {};
                if (statusColor === 'success') {
                  return {
                    bgcolor: theme.palette.success.main,
                    color: theme.palette.success.contrastText,
                    borderColor: theme.palette.success.main,
                  };
                }
                if (statusColor === 'error') {
                  return {
                    bgcolor: theme.palette.error.main,
                    color: theme.palette.error.contrastText,
                    borderColor: theme.palette.error.main,
                  };
                }
                if (statusColor === 'warning') {
                  return {
                    bgcolor: theme.palette.warning.main,
                    color: theme.palette.warning.contrastText,
                    borderColor: theme.palette.warning.main,
                  };
                }
                if (statusColor === 'info') {
                  return {
                    bgcolor: theme.palette.info.main,
                    color: theme.palette.info.contrastText,
                    borderColor: theme.palette.info.main,
                  };
                }
                return {
                  bgcolor: theme.palette.grey[700],
                  color: theme.palette.common.white,
                  borderColor: theme.palette.grey[700],
                };
              })();
              const hoverStyle =
                !isDetailSelected && isDetailHoverPreviewActive
                  ? { borderColor: theme.palette.primary.main }
                  : {};
              return {
                ...selectedStyle,
                ...hoverStyle,
              };
            }}
            onMouseEnter={() => {
              if (summary) {
                onDetailHoverChange?.({ title, summary, task });
              }
            }}
            onMouseLeave={() => {
              onDetailHoverChange?.(null);
            }}
            onClick={() => {
              if (!summary) return;
              onDetailClick?.({ title, summary, task });
            }}
          />
        </Stack>
      </Box>
      <Box sx={{ position: 'relative' }}>
        <LinearProgress
          variant="determinate"
          value={progressValue}
          color={statusColor === 'default' ? 'primary' : statusColor}
        />
        {showRunningOverlay ? (
          <LinearProgress
            variant="indeterminate"
            color="info"
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.35,
            }}
          />
        ) : null}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, mt: '2px' }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minHeight: '1.2em' }}>
          <Typography
            data-testid="task-inline-summary"
            variant="caption"
            color="text.disabled"
            sx={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              visibility: displayMessage ? 'visible' : 'hidden',
            }}
          >
            {displayMessage}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
};
