import type React from 'react';
import { Box, Chip, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

type Props = {
  title: string;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  message?: string;
  detailLines?: string[];
  progress?: number;
  fallbackProgress: number;
};

export const TASK_ITEM_HEIGHT = 50;

export const TaskItem: React.FC<Props> = ({
  title,
  statusLabel,
  statusColor,
  message,
  detailLines,
  progress,
  fallbackProgress,
}) => {
  const displayMessage = message ?? detailLines?.[0] ?? '';

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
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress ?? fallbackProgress))}
        color={statusColor === 'default' ? 'primary' : statusColor}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 0, flex: 1, overflow: 'hidden' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ flex: 1 }}>
            {title}
          </Typography>
          <Chip label={statusLabel} color={statusColor} size="small" variant="outlined" />
        </Stack>
        <Tooltip
          title={displayMessage}
          placement="top-start"
          disableHoverListener={!displayMessage}
          disableFocusListener={!displayMessage}
          disableTouchListener={!displayMessage}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              minHeight: '1.2em',
              maxHeight: '1.2em',
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
