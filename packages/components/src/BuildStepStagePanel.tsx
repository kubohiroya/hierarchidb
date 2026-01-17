import { type FC, memo, type ReactNode } from 'react';
import { Box, Chip, CircularProgress, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

export type BuildStepStageTaskCount = {
  Completed: number;
  Failed: number;
  Skip: number;
  Total?: number;
};

export type BuildStepStageSummaryPanelProps = {
  title: string;
  icon: ReactNode;
  description?: string;
  progress: number;
  progressContent?: ReactNode;
  taskCount?: BuildStepStageTaskCount;
  concurrencyIndicator?: {
    count: number;
    isRunning: boolean;
  };
  failedMode: boolean;
  onFailedModeUpdate: (newMode: boolean) => void;
  completedMode: boolean;
  onCompletedModeUpdate: (newMode: boolean) => void;
  children?: ReactNode;
};

const BuildStepStagePanelCore: FC<BuildStepStageSummaryPanelProps> = ({
  title,
  icon,
  description,
  progress,
  progressContent,
  taskCount,
  concurrencyIndicator,
  failedMode,
  onFailedModeUpdate,
  completedMode,
  onCompletedModeUpdate,
  children,
}) => {
  const theme = useTheme();
  const completed = taskCount?.Completed ?? 0;
  const failed = taskCount?.Failed ?? 0;
  const skipped = taskCount?.Skip ?? 0;
  const total = taskCount?.Total ?? (completed + failed + skipped);
  const completedNumerator = total === 0
    ? 0
    : Math.min(total, completed + skipped);
  const completedLabel = `${completedNumerator}/${total}`;
  const isFailedDisabled = failed === 0;
  const isCompletedDisabled = completedNumerator === 0;
  const failedVariant = isFailedDisabled ? 'outlined' : (failedMode ? 'filled' : 'outlined');
  const completedVariant = isCompletedDisabled ? 'outlined' : (completedMode ? 'filled' : 'outlined');
  const indicatorCount = Math.max(0, Math.floor(concurrencyIndicator?.count ?? 0));
  const isIndicatorRunning = concurrencyIndicator?.isRunning ?? false;
  const indicatorVariant = isIndicatorRunning ? 'indeterminate' : 'determinate';
  const indicatorIdleColor = theme.palette.mode === 'dark'
    ? theme.palette.grey[800]
    : theme.palette.grey[400];
  const indicatorSx = isIndicatorRunning ? undefined : { color: indicatorIdleColor };
  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            {icon ? <Box>{icon}</Box> : null}
            <Typography variant="subtitle2">{title}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {indicatorCount > 0 ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                {Array.from({ length: indicatorCount }).map((_, index) => (
                  <CircularProgress
                    key={`stage-slot-${index}`}
                    size={14}
                    variant={indicatorVariant}
                    value={indicatorVariant === 'determinate' ? 100 : undefined}
                    sx={indicatorSx}
                  />
                ))}
              </Stack>
            ) : null}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={`${failed}`}
                size="small"
                color={isFailedDisabled ? 'default' : 'error'}
                icon={<ErrorOutlineIcon fontSize="small" />}
                variant={failedVariant}
                disabled={isFailedDisabled}
                onClick={isFailedDisabled ? undefined : () => onFailedModeUpdate(!failedMode)}
                sx={isFailedDisabled ? { borderColor: 'divider', color: 'text.disabled' } : undefined}
              />
              <Chip
                label={completedLabel}
                size="small"
                color={isCompletedDisabled ? 'default' : 'success'}
                icon={<TaskAltIcon fontSize="small" />}
                variant={completedVariant}
                disabled={isCompletedDisabled}
                onClick={isCompletedDisabled ? undefined : () => onCompletedModeUpdate(!completedMode)}
                sx={isCompletedDisabled ? { borderColor: 'divider', color: 'text.disabled' } : undefined}
              />
            </Stack>
          </Stack>
        </Stack>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
        {progressContent ?? (
          <LinearProgress
            variant="determinate"
            value={progress}
          />
        )}
      </Stack>
      {children ? (
        <Box flex={1} minHeight={0}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
};

export const BuildStepStagePanel = memo(BuildStepStagePanelCore);
