import { formatBytes } from '@hierarchidb/util';
import { Box, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import type React from 'react';
import { useMemoryUsageChartCanvas } from './useMemoryUsageChartCanvas.js';
import { useMemoryUsageChartData } from './useMemoryUsageChartData.js';

interface MemoryUsageChartProps {
  /**
   * (: '300px', '100%')
   */
  width?: string | number;
  /**
   * (: '100px')
   */
  height?: string | number;
  /**
   */
  updateInterval?: number;
  /**
   * 0-1
   */
  warningThreshold?: number;
  /**
   * 0-1
   */
  criticalThreshold?: number;
  /**
   */
  maxDataPoints?: number;
  /**
   * -
   */
  maxMemory?: number;
}

const ChartContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

// formatBytes now imported from @hierarchidb/core

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

/**
 */
export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  width = '100%',
  height = 80,
  updateInterval = 10000,
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  maxDataPoints = 30,
  maxMemory = 4 * 1024 * 1024 * 1024, //  4GB
}) => {
  const theme = useTheme();
  const { dataPoints, currentMemory, isSupported } = useMemoryUsageChartData({
    maxMemory,
    maxDataPoints,
    updateInterval,
  });
  const { canvasRef } = useMemoryUsageChartCanvas({
    dataPoints,
    warningThreshold,
    criticalThreshold,
    maxDataPoints,
    palette: {
      divider: theme.palette.divider,
      warningMain: theme.palette.warning.main,
      errorMain: theme.palette.error.main,
      primaryMain: theme.palette.primary.main,
    },
  });

  if (!isSupported) {
    return (
      <Paper
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Memory monitoring not available
        </Typography>
      </Paper>
    );
  }

  const tooltipContent = (
    <Box>
      <Typography variant="body2" fontWeight="bold" gutterBottom>
        Memory Usage Trend
      </Typography>
      <Typography variant="caption">
        Current: {formatBytes(currentMemory.used)} / {formatBytes(currentMemory.total)}
      </Typography>
      <br />
      <Typography variant="caption">Percentage: {currentMemory.percentage.toFixed(1)}%</Typography>
      <br />
      <Typography variant="caption">Data points: {dataPoints.length}</Typography>
      {dataPoints.length > 0 && (
        <>
          <br />
          <Typography variant="caption">
            Time range: {formatTime(dataPoints[0]?.timestamp || 0)} -{' '}
            {formatTime(dataPoints[dataPoints.length - 1]?.timestamp || 0)}
          </Typography>
        </>
      )}
    </Box>
  );

  return (
    <Tooltip title={tooltipContent} placement="top">
      <ChartContainer sx={{ width, height, cursor: 'help' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
            borderRadius: 1,
            padding: '2px 6px',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 'bold',
              fontSize: '0.7rem',
              color:
                currentMemory.percentage >= criticalThreshold * 100
                  ? 'error.main'
                  : currentMemory.percentage >= warningThreshold * 100
                    ? 'warning.main'
                    : 'text.primary',
            }}
          >
            {currentMemory.percentage.toFixed(0)}%
          </Typography>
        </Box>
      </ChartContainer>
    </Tooltip>
  );
};
