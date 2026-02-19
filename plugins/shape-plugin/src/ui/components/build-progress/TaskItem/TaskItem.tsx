import type React from 'react';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

type Props = {
  title: string;
  leadingIcon?: React.ReactNode;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  isRunning?: boolean;
  message?: string;
  detailLines?: string[];
  progress?: number;
  fallbackProgress: number;
};

export const TASK_ITEM_HEIGHT = 56;

export const TaskItem: React.FC<Props> = ({
  title,
  leadingIcon,
  statusLabel,
  statusColor,
  isRunning = false,
  message,
  detailLines,
  progress,
  fallbackProgress,
}) => {
  const displayMessage = message ?? detailLines?.[0] ?? '';
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
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Tooltip
          title={displayMessage}
          placement="top-start"
          disableHoverListener={!displayMessage}
          disableFocusListener={!displayMessage}
          disableTouchListener={!displayMessage}
        >
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              minHeight: '1.2em',
              maxHeight: '1.2em',
              mt: '2px',
              visibility: displayMessage ? 'visible' : 'hidden',
            }}
          >
            {displayMessage}
          </Typography>
        </Tooltip>
      </Box>
    </Box>
  );
};
