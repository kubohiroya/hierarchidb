import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { Box, IconButton, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import { Pause, PlayArrow, Refresh, ZoomIn, ZoomOut } from '@mui/icons-material';
import { formatBytes } from '@hierarchidb/util';

import { useMemoryData } from './hooks/useMemoryData.js';
import { CanvasRenderer } from './services/CanvasRenderer.js';

export interface MemoryUsageChartProps {
  variant?: 'simple' | 'detailed' | 'compact';
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
                                                                    variant = 'detailed',
                                                                    width = '100%',
                                                                    height = 300,
                                                                    updateInterval = 5000,
                                                                    //  timeRange = 300, // 5 -
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
                                                                    maxMemory = 4 * 1024 * 1024 * 1024, // 4GB
                                                                  }) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

    const {
    memoryData,
    isSupported,
    isPaused,
    togglePause,
    clearData: clearMemoryData,
    error,
  } = useMemoryData({
    updateInterval,
    maxMemory,
    enabled: true,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      //  : Canvas
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    } catch (error) {
      //  : Canvas
      console.error('Failed to initialize canvas renderer:', error);
      return;
    }

        return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current || !memoryData || memoryData.used === 0) return;

    try {
      rendererRef.current.addDataPoint(memoryData, maxDataPoints);

      rendererRef.current.render({
        width: canvasRef.current?.getBoundingClientRect().width || 800,
        height: canvasRef.current?.getBoundingClientRect().height || 300,
        theme,
        categoryColors,
        warningThreshold,
        criticalThreshold,
        showGrid,
        showAxes: true,
      });
    } catch (error) {
      //  :
      console.warn('Chart rendering failed:', error);
    }
  }, [
    memoryData,
    theme,
    categoryColors,
    warningThreshold,
    criticalThreshold,
    showGrid,
    maxDataPoints,
  ]);

  const handleClearData = useCallback(() => {
    clearMemoryData();
    if (rendererRef.current) {
      rendererRef.current.clearData();
    }
  }, [clearMemoryData]);

  const getComponentHeight = () => {
    switch (variant) {
      case 'compact':
        return typeof height === 'number' ? height * 0.6 : 180;
      case 'simple':
        return typeof height === 'number' ? height * 0.8 : 240;
      default:
        return height;
    }
  };

  //  : API
  if (!isSupported || error) {
    return (
      <Paper
        sx={{
          width,
          height: getComponentHeight(),
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {error || 'Memory monitoring not available in this browser'}
        </Typography>
        {error && (
          <Typography variant="caption" color="error" textAlign="center">
            Please check browser compatibility or try refreshing the page
          </Typography>
        )}
      </Paper>
    );
  }

  return (
    <Paper sx={{ width, height: getComponentHeight(), p: 2, position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, display: 'flex', gap: 1 }}>
        <Tooltip title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}>
          <IconButton size="small" onClick={togglePause} color={isPaused ? 'warning' : 'default'}>
            {isPaused ? <PlayArrow fontSize="small" /> : <Pause fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear all chart data">
          <IconButton size="small" onClick={handleClearData}>
            <Refresh fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom in (coming soon)">
          <IconButton size="small" disabled>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Zoom out (coming soon)">
          <IconButton size="small" disabled>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Memory Usage Timeline
        {isPaused && (
          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1 }}>
            (Paused)
          </Typography>
        )}
      </Typography>

      <Box sx={{ mb: variant === 'compact' ? 1 : 2 }}>
        <Typography
          variant="body2"
          sx={{
            color:
              memoryData.percentage > criticalThreshold * 100
                ? 'error.main'
                : memoryData.percentage > warningThreshold * 100
                  ? 'warning.main'
                  : 'text.primary',
          }}
        >
          Current Usage: {memoryData.percentage.toFixed(1)}%
        </Typography>
        {variant !== 'compact' && (
          <Typography variant="caption" color="text.secondary">
            {formatBytes(memoryData.used)} / {formatBytes(memoryData.total)}
            {memoryData.breakdown && (
              <Typography component="span" sx={{ ml: 1 }}>
                • JavaScript: {formatBytes(memoryData.breakdown.JavaScript)}
              </Typography>
            )}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: variant === 'compact' ? 'calc(100% - 80px)' : 'calc(100% - 120px)',
          minHeight: '120px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: '4px',
          }}
          aria-label={`Memory usage chart showing ${memoryData.percentage.toFixed(1)}% usage`}
        />
      </Box>

      {showLegend && variant !== 'compact' && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Object.entries(categoryColors).map(([category, color]) => (
            <Box key={category} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  bgcolor: color,
                  opacity: 0.8,
                  borderRadius: '2px',
                }}
              />
              <Typography variant="caption">{category}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {error && (
        <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
          <Typography variant="caption" color="error">
            ⚠️ Data collection error
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
