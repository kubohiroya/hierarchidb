import type React from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

type Props = {
  title: string;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  message?: string;
  progress?: number;
  fallbackProgress: number;
};

export const ShapeBuildTaskItem: React.FC<Props> = ({
  title,
  statusLabel,
  statusColor,
  message,
  progress,
  fallbackProgress,
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" sx={{ flex: 1 }}>
        {title}
      </Typography>
      <Chip label={statusLabel} color={statusColor} size="small" variant="outlined" />
    </Stack>
    {message ? (
      <Typography variant="caption" color="text.secondary">
        {message}
      </Typography>
    ) : null}
    <LinearProgress
      variant="determinate"
      value={Math.min(100, Math.max(0, progress ?? fallbackProgress))}
      color={statusColor === 'default' ? 'primary' : statusColor}
    />
  </Box>
);
