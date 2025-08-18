import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Tooltip, Paper, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';
import { formatBytes } from '@hierarchidb/core';
import { createLogger } from '@hierarchidb/ui-core';

const logger = createLogger('Monitor');

interface MemoryUsageChartProps {
  /** 幅 (例: '300px', '100%') */
  width?: string | number;
  /** 高さ (例: '100px') */
  height?: string | number;
  /** 更新間隔（ミリ秒） */
  updateInterval?: number;
  /** 使用量の警告しきい値（0-1） */
  warningThreshold?: number;
  /** 使用量の危険しきい値（0-1） */
  criticalThreshold?: number;
  /** データポイントの最大数 */
  maxDataPoints?: number;
  /** 最大メモリサイズ（バイト）- 自動検出できない場合のフォールバック */
  maxMemory?: number;
}

interface DataPoint {
  timestamp: number;
  percentage: number;
  used: number;
  total: number;
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
 * メモリ使用量を折れ線グラフで表示するコンポーネント
 */
export const MemoryUsageChart: React.FC<MemoryUsageChartProps> = ({
  width = '100%',
  height = 80,
  updateInterval = 10000,
  warningThreshold = 0.7,
  criticalThreshold = 0.9,
  maxDataPoints = 30,
  maxMemory = 4 * 1024 * 1024 * 1024, // デフォルト4GB
}) => {
  const theme = useTheme();
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [currentMemory, setCurrentMemory] = useState({ used: 0, total: maxMemory, percentage: 0 });
  const [isSupported, setIsSupported] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateMemoryInfo = useCallback(async () => {
    try {
      let used = 0;
      let total = maxMemory;

      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as unknown as {
            measureUserAgentSpecificMemory: () => Promise<{ breakdown: Array<{ bytes?: number }> }>;
          }
        ).measureUserAgentSpecificMemory();
        used = result.breakdown.reduce(
          (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
          0
        );

        if ('memory' in performance) {
          const memory = (
            performance as unknown as {
              memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
            }
          ).memory;
          if (memory.jsHeapSizeLimit) {
            total = memory.jsHeapSizeLimit;
          }
        }
      } else if ('memory' in performance) {
        const memory = (
          performance as unknown as {
            memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
          }
        ).memory;
        used = memory.usedJSHeapSize || 0;
        total = memory.jsHeapSizeLimit || maxMemory;
      } else {
        setIsSupported(false);
        return;
      }

      const percentage = total > 0 ? (used / total) * 100 : 0;
      const timestamp = Date.now();

      setCurrentMemory({ used, total, percentage });

      setDataPoints((prev) => {
        const newPoints = [...prev, { timestamp, percentage, used, total }];
        // Keep only the last maxDataPoints
        if (newPoints.length > maxDataPoints) {
          return newPoints.slice(-maxDataPoints);
        }
        return newPoints;
      });
    } catch (error) {
      logger.devWarn('Memory measurement failed:', String(error));
    }
  }, [maxMemory, maxDataPoints]);

  // Draw the chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw grid lines
    ctx.strokeStyle = theme.palette.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (rect.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw threshold lines
    const warningY = rect.height * (1 - warningThreshold);
    const criticalY = rect.height * (1 - criticalThreshold);

    ctx.strokeStyle = theme.palette.warning.main;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, warningY);
    ctx.lineTo(rect.width, warningY);
    ctx.stroke();

    ctx.strokeStyle = theme.palette.error.main;
    ctx.beginPath();
    ctx.moveTo(0, criticalY);
    ctx.lineTo(rect.width, criticalY);
    ctx.stroke();

    // Draw the line chart
    const xStep = rect.width / (maxDataPoints - 1);

    // Create gradient with theme colors
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    const primaryRgb = theme.palette.primary.main.replace('#', '');
    const warningRgb = theme.palette.warning.main.replace('#', '');
    const errorRgb = theme.palette.error.main.replace('#', '');

    // Convert hex to rgba
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    gradient.addColorStop(0, hexToRgba(primaryRgb, 0.6));
    gradient.addColorStop(1 - criticalThreshold, hexToRgba(primaryRgb, 0.6));
    gradient.addColorStop(1 - warningThreshold, hexToRgba(warningRgb, 0.6));
    gradient.addColorStop(1, hexToRgba(errorRgb, 0.6));

    // Draw area under the line
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, rect.height);

    dataPoints.forEach((point, index) => {
      const x = index * xStep;
      const y = rect.height * (1 - point.percentage / 100);
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo((dataPoints.length - 1) * xStep, rect.height);
    ctx.closePath();
    ctx.fill();

    // Draw the line
    ctx.strokeStyle = theme.palette.primary.main;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataPoints.forEach((point, index) => {
      const x = index * xStep;
      const y = rect.height * (1 - point.percentage / 100);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = theme.palette.primary.main;
    dataPoints.forEach((point, index) => {
      const x = index * xStep;
      const y = rect.height * (1 - point.percentage / 100);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [
    dataPoints,
    warningThreshold,
    criticalThreshold,
    maxDataPoints,
    theme.palette.divider,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.primary.main,
  ]);

  useEffect(() => {
    // Initial update
    updateMemoryInfo();

    // Set up interval
    const safeInterval = Math.max(updateInterval, 10000);
    intervalRef.current = setInterval(updateMemoryInfo, safeInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateInterval, updateMemoryInfo]);

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
