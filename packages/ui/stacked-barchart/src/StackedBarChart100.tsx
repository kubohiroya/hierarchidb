import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export type StackedBarChartSegment = {
  id: string;
  value: number;
  color: string;
  title?: string;
};

export type StackedBarChart100Props = {
  segments: StackedBarChartSegment[];
  total: number;
  height?: number;
  borderRadius?: number;
  backgroundColor?: string;
  ariaLabel?: string;
  endAdornment?: ReactNode;
};

const clampNonNegative = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

export const StackedBarChart100 = ({
  segments,
  total,
  height = 8,
  borderRadius = 999,
  backgroundColor = 'rgba(148, 163, 184, 0.25)',
  ariaLabel,
  endAdornment,
}: StackedBarChart100Props) => {
  const safeTotal = Math.max(1, clampNonNegative(total));
  const resolvedSegments = segments
    .map((segment) => ({
      ...segment,
      value: Math.min(safeTotal, clampNonNegative(segment.value)),
    }))
    .filter((segment) => segment.value > 0);

  const remainder = Math.max(0, safeTotal - resolvedSegments.reduce((sum, segment) => sum + segment.value, 0));
  if (remainder > 0) {
    resolvedSegments.push({
      id: '__remainder__',
      value: remainder,
      color: backgroundColor,
      title: undefined,
    });
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        role="img"
        aria-label={ariaLabel}
        sx={{
          display: 'flex',
          width: '100%',
          minWidth: 120,
          height,
          overflow: 'hidden',
          borderRadius,
          bgcolor: backgroundColor,
        }}
      >
        {resolvedSegments.map((segment) => {
          const width = `${(segment.value / safeTotal) * 100}%`;
          return (
            <Box
              key={segment.id}
              title={segment.title}
              sx={{
                width,
                minWidth: segment.id === '__remainder__' ? 0 : 1,
                bgcolor: segment.color,
                transition: 'width 120ms ease-out',
              }}
            />
          );
        })}
      </Box>
      {endAdornment}
    </Box>
  );
};
