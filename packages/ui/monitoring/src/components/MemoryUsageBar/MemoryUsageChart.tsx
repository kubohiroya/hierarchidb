import { formatBytes } from '@hierarchidb/util';
import { Pause, PlayArrow, Refresh, ZoomIn, ZoomOut } from '@mui/icons-material';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import type React from 'react';
import { useMemoryUsageChart } from './useMemoryUsageChart';

interface MemoryUsageChartProps {
  width?: string | number;
  height?: number;
  updateInterval?: number;
  timeRange?: number;
  maxDataPoints?: number;
  categoryColors?: { [key: string]: string };
  warningThreshold?: number;
  criticalThreshold?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  maxMemory?: number;
}

export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  width = '100%',
  height = 300,
  updateInterval = 10000,
  timeRange = 300,
  maxDataPoints = 100,
  categoryColors = {
    JavaScript: '#F7DF1E',
    DOM: '#E34C26',
    Images: '#00D8FF',
    Styles: '#1572B6',
    Other: '#9CA3AF',
  },
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  showGrid = true,
  showLegend = true,
  maxMemory = 4 * 1024 * 1024 * 1024,
}) => {
  const theme = useTheme();
  const {
    canvasRef,
    isPaused,
    isSupported,
    hoveredPoint,
    setHoveredPoint,
    setIsPaused,
    setZoomLevel,
    setDataPoints,
    handleMouseMove,
  } = useMemoryUsageChart({
    updateInterval,
    maxDataPoints,
    maxMemory,
    timeRange,
    showGrid,
    categoryColors,
    warningThreshold,
    criticalThreshold,
    theme,
  });

  if (!isSupported) {
    return (
      <Paper
        sx={{
          width,
          height,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Memory monitoring not available in this browser
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width, height, p: 2, position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', gap: 1 }}>
        <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
          <IconButton size="small" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear data">
          <IconButton size="small" onClick={() => setDataPoints([])}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom in">
          <IconButton size="small" onClick={() => setZoomLevel((z) => Math.min(z * 1.5, 10))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom out">
          <IconButton size="small" onClick={() => setZoomLevel((z) => Math.max(z / 1.5, 1))}>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Memory Usage Timeline
      </Typography>

      <Box sx={{ position: 'relative', width: '100%', height: 'calc(100% - 80px)' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        />

        {hoveredPoint && (
          <Paper
            elevation={3}
            sx={{
              position: 'absolute',
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 10,
              p: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <Typography variant="caption" display="block">
              {new Date(hoveredPoint.data.timestamp).toLocaleTimeString()}
            </Typography>
            <Typography variant="caption" display="block" fontWeight="bold">
              Total: {formatBytes(hoveredPoint.data.used)} ({hoveredPoint.data.percentage.toFixed(1)}%)
            </Typography>
            {hoveredPoint.data.breakdown && (
              <Box sx={{ mt: 0.5 }}>
                {Object.entries(hoveredPoint.data.breakdown).map(([category, bytes]) => (
                  <Typography key={category} variant="caption" display="block">
                    {category}: {formatBytes(bytes)}
                  </Typography>
                ))}
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {showLegend && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
          {Object.entries(categoryColors).map(([category, color]) => (
            <Box key={category} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: color, opacity: 0.7 }} />
              <Typography variant="caption">{category}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};
