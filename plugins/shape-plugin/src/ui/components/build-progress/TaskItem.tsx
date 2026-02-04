import type React from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';

type Props = {
  title: string;
  statusLabel: string;
  statusColor: 'default' | 'success' | 'error' | 'warning' | 'info';
  message?: string;
  detailLines?: string[];
  progress?: number;
  fallbackProgress: number;
};

export const TaskItem: React.FC<Props> = ({
  title,
  statusLabel,
  statusColor,
  message,
  detailLines,
  progress,
  fallbackProgress,
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" sx={{ flex: 1 }}>
        {title}
      </Typography>
      <Chip
        label={statusLabel}
        color={statusColor}
        size="small"
        variant="outlined"
        sx={{ transform: 'translateY(8px)' }}
      />
    </Stack>
    {message ? (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          lineHeight: 1.4,
          minHeight: '2.8em',
          maxHeight: '2.8em',
        }}
      >
        {message}
      </Typography>
    ) : null}
    {detailLines?.length ? (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {detailLines.map((line, index) => (
          <Typography key={`${index.toString()}-${line}`} variant="caption" color="text.secondary">
            {line}
          </Typography>
        ))}
      </Box>
    ) : null}
    <LinearProgress
      variant="determinate"
      value={Math.min(100, Math.max(0, progress ?? fallbackProgress))}
      color={statusColor === 'default' ? 'primary' : statusColor}
    />
  </Box>
);
