import type React from 'react';
import { useMemo } from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { TASK_ITEM_HEIGHT } from './taskItem.constants.ts';

type TaskMetric = {
  input: number | null;
  output: number | null;
};

export type TaskOutcomeSummary = {
  kind: 'completed' | 'failed' | 'skipped' | 'other';
  visualization?: 'none' | 'transformMetrics';
  summaryLine: string;
  detailLines?: string[];
  effectiveTolerance?: number | null;
  retryAttempt?: number | null;
  retryMax?: number | null;
  vertexReductionRate?: number | null;
  metrics?: {
    features: TaskMetric;
    polygons: TaskMetric;
    vertices: TaskMetric;
  };
  vertexLimit?: number | null;
};

type Props = {
  title: string;
  leadingIcon?: React.ReactNode;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  isRunning?: boolean;
  summary?: TaskOutcomeSummary;
  progress?: number;
  fallbackProgress: number;
  onDetailHoverChange?: (value: { title: string; summary: TaskOutcomeSummary } | null) => void;
};

export const TaskItem: React.FC<Props> = ({
  title,
  leadingIcon,
  statusLabel,
  statusColor,
  isRunning = false,
  summary,
  progress,
  fallbackProgress,
  onDetailHoverChange,
}) => {
  const displayMessage = summary?.summaryLine ?? '';
  const chartColor = summary?.kind === 'failed' ? 'error.main' : 'primary.main';
  const progressValue = Math.min(100, Math.max(0, progress ?? fallbackProgress));
  const showRunningOverlay = isRunning && progressValue < 100;
  const volumeScaleMax = useMemo(() => {
    if (!summary?.metrics) return 0;
    return Math.max(
      summary.metrics.features?.input ?? 0,
      summary.metrics.polygons?.input ?? 0,
      summary.metrics.vertices?.input ?? 0,
      summary.metrics.features?.output ?? 0,
      summary.metrics.polygons?.output ?? 0,
      summary.metrics.vertices?.output ?? 0,
    );
  }, [summary]);

  const renderMiniBar = (
    value: number | null | undefined,
    max: number | null | undefined,
    colorToken: string,
    trackColorToken = 'grey.300',
  ): React.ReactNode => {
    if (value === null || value === undefined || max === null || max === undefined || max <= 0) {
      return <Typography variant="caption" color="text.disabled">N/A</Typography>;
    }
    const ratio = Math.max(0, Math.min(1, value / max));
    return (
      <Box sx={{ position: 'relative', width: 36, height: 6, bgcolor: trackColorToken, borderRadius: 999, overflow: 'hidden' }}>
        <Box sx={{ width: `${ratio * 100}%`, height: '100%', bgcolor: colorToken }} />
      </Box>
    );
  };

  const renderMiniVolumeGroup = (): React.ReactNode => {
    if (!summary?.metrics || volumeScaleMax <= 0) return <Typography variant="caption" color="text.disabled">N/A</Typography>;
    const metrics = [
      summary.metrics.features,
      summary.metrics.polygons,
      summary.metrics.vertices,
    ];
    const vertexLimitRatio = summary.vertexLimit !== null && summary.vertexLimit !== undefined
      ? Math.max(0, Math.min(1, summary.vertexLimit / volumeScaleMax))
      : null;
    return (
      <Box sx={{ position: 'relative', display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 18, width: 30 }}>
        {metrics.map((metric, index) => {
          const inputRatio = metric.input !== null ? Math.max(0, Math.min(1, metric.input / volumeScaleMax)) : 0;
          const outputRatio = metric.output !== null ? Math.max(0, Math.min(1, metric.output / volumeScaleMax)) : 0;
          return (
            <Box key={`metric-${index}`} sx={{ position: 'relative', width: 8, height: '100%' }}>
              <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${inputRatio * 100}%`, bgcolor: 'grey.300', borderRadius: '2px 2px 0 0' }} />
              <Box sx={{ position: 'absolute', left: 1, right: 1, bottom: 0, height: `${outputRatio * 100}%`, bgcolor: chartColor, borderRadius: '2px 2px 0 0' }} />
              {index === 2 && vertexLimitRatio !== null ? (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${vertexLimitRatio * 100}%`,
                    borderTop: '1px solid',
                    borderColor: 'warning.main',
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderMiniDonut = (): React.ReactNode => {
    if (!summary || summary.vertexReductionRate === null || summary.vertexReductionRate === undefined) {
      return <Typography variant="caption" color="text.disabled">N/A</Typography>;
    }
    const ratio = Math.max(0, Math.min(1, summary.vertexReductionRate));
    return (
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: (theme) => `conic-gradient(${theme.palette.primary.main} ${ratio * 360}deg, ${theme.palette.grey[300]} 0deg)`,
          border: '1px solid',
          borderColor: 'divider',
        }}
      />
    );
  };

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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: '2px' }}>
          {leadingIcon ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {leadingIcon}
            </Box>
          ) : null}
          <Typography variant="caption" sx={{ flex: 1, fontSize: '14px' }}>
            {title}
          </Typography>
          <Chip label={statusLabel} color={statusColor} size="small" variant="outlined" />
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
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          onMouseEnter={() => {
            if (summary) {
              onDetailHoverChange?.({ title, summary });
            }
          }}
          onMouseLeave={() => {
            onDetailHoverChange?.(null);
          }}
          sx={{ minHeight: '1.2em' }}
        >
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
          {summary?.visualization === 'transformMetrics' ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              {renderMiniBar(
                summary.effectiveTolerance,
                summary.effectiveTolerance != null ? Math.max(summary.effectiveTolerance, 1) : null,
                chartColor,
              )}
              {renderMiniBar(
                summary.retryAttempt,
                summary.retryMax ?? summary.retryAttempt,
                chartColor,
                'grey.300',
              )}
              {renderMiniVolumeGroup()}
              {renderMiniDonut()}
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
};
