import { type FC, memo, type ReactNode } from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
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
  description?: string;
  progress: number;
  taskCount?: BuildStepStageTaskCount;
  failedMode: boolean;
  onFailedModeUpdate: (newMode: boolean) => void;
  completedMode: boolean;
  onCompletedModeUpdate: (newMode: boolean) => void;
  children?: ReactNode;
};

const BuildStepStagePanelCore: FC<BuildStepStageSummaryPanelProps> = ({
  title,
  description,
  progress,
  taskCount,
  failedMode,
  onFailedModeUpdate,
  completedMode,
  onCompletedModeUpdate,
  children,
}) => {
  const completed = taskCount?.Completed ?? 0;
  const failed = taskCount?.Failed ?? 0;
  const skipped = taskCount?.Skip ?? 0;
  const total = taskCount?.Total ?? (completed + failed + skipped);
  const completedNumerator = total === 0
    ? 0
    : Math.min(total, completed + skipped);
  const completedLabel = `Completed ${completedNumerator}/${total}`;
  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
      <Stack spacing={1} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">{title}</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip
              label={`Failed ${failed}`}
              size="small"
              color="error"
              icon={<ErrorOutlineIcon fontSize="small" />}
              variant={failedMode ? 'filled' : 'outlined'}
              onClick={() => onFailedModeUpdate(!failedMode)}
            />
            <Chip
              label={completedLabel}
              size="small"
              color="success"
              icon={<TaskAltIcon fontSize="small" />}
              variant={completedMode ? 'filled' : 'outlined'}
              onClick={() => onCompletedModeUpdate(!completedMode)}
            />
          </Stack>
        </Stack>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
        <LinearProgress
          variant="determinate"
          value={progress}
        />
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
