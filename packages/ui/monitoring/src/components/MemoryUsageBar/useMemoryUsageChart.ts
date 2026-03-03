import { formatBytes } from '@hierarchidb/util';
import type { Theme } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDevEnv } from '~/utils/env';

interface MemoryDataPoint {
  timestamp: number;
  used: number;
  total: number;
  percentage: number;
  breakdown?: {
    [key: string]: number;
  };
}

type UseMemoryUsageChartParams = {
  updateInterval: number;
  maxDataPoints: number;
  maxMemory: number;
  timeRange: number;
  showGrid: boolean;
  categoryColors: { [key: string]: string };
  warningThreshold: number;
  criticalThreshold: number;
  theme: Theme;
};

export const useMemoryUsageChart = ({
  updateInterval,
  maxDataPoints,
  maxMemory,
  timeRange,
  showGrid,
  categoryColors,
  warningThreshold,
  criticalThreshold,
  theme,
}: UseMemoryUsageChartParams) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dataPoints, setDataPoints] = useState<MemoryDataPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    data: MemoryDataPoint;
  } | null>(null);

  const categorizeMemory = useCallback(
    (
      breakdown?: Array<{ bytes?: number; types?: string[]; url?: string }>
    ): { [key: string]: number } => {
      const categories: Record<string, number> = {
        JavaScript: 0,
        DOM: 0,
        Images: 0,
        Styles: 0,
        Other: 0,
      };

      if (!breakdown) return categories;

      breakdown.forEach((entry) => {
        const bytes = entry.bytes || 0;
        const types = entry.types || [];

        if (types.includes('JavaScript')) {
          categories.JavaScript = (categories.JavaScript || 0) + bytes;
        } else if (types.includes('DOM')) {
          categories.DOM = (categories.DOM || 0) + bytes;
        } else if (
          entry.url
          && (entry.url.includes('.jpg') || entry.url.includes('.png') || entry.url.includes('.gif'))
        ) {
          categories.Images = (categories.Images || 0) + bytes;
        } else if (entry.url && (entry.url.includes('.css') || types.includes('CSS'))) {
          categories.Styles = (categories.Styles || 0) + bytes;
        } else {
          categories.Other = (categories.Other || 0) + bytes;
        }
      });

      return categories;
    },
    []
  );

  const collectMemoryData = useCallback(async () => {
    if (isPaused) return;

    try {
      let memoryData: MemoryDataPoint;

      if ('measureUserAgentSpecificMemory' in performance) {
        const result = await (
          performance as {
            measureUserAgentSpecificMemory: () => Promise<{
              breakdown: Array<{ bytes?: number; types?: string[]; url?: string }>;
            }>;
          }
        ).measureUserAgentSpecificMemory();
        const totalUsed = result.breakdown.reduce(
          (sum: number, entry: { bytes?: number }) => sum + (entry.bytes || 0),
          0
        );

        let totalMemory = maxMemory;
        if ('memory' in performance) {
          const memory = (
            performance as {
              memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
            }
          ).memory;
          if (memory.jsHeapSizeLimit) {
            totalMemory = memory.jsHeapSizeLimit;
          }
        }

        memoryData = {
          timestamp: Date.now(),
          used: totalUsed,
          total: totalMemory,
          percentage: (totalUsed / totalMemory) * 100,
          breakdown: categorizeMemory(result.breakdown),
        };
      } else if ('memory' in performance) {
        const memory = (
          performance as {
            memory: { jsHeapSizeLimit?: number; usedJSHeapSize?: number };
          }
        ).memory;
        const used = memory.usedJSHeapSize || 0;
        const total = memory.jsHeapSizeLimit || maxMemory;

        memoryData = {
          timestamp: Date.now(),
          used,
          total,
          percentage: total > 0 ? (used / total) * 100 : 0,
          breakdown: {
            JavaScript: used,
            DOM: 0,
            Images: 0,
            Styles: 0,
            Other: 0,
          },
        };
      } else {
        setIsSupported(false);
        return;
      }

      setDataPoints((prev) => {
        const newPoints = [...prev, memoryData];
        if (newPoints.length > maxDataPoints) {
          return newPoints.slice(-maxDataPoints);
        }
        return newPoints;
      });
    } catch (error) {
      if (isDevEnv()) {
        console.warn('Memory measurement failed:', error);
      }
    }
  }, [isPaused, maxMemory, categorizeMemory, maxDataPoints]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const padding = { top: 20, right: 80, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    const now = Date.now();
    const startTime = now - (timeRange * 1000) / zoomLevel;
    const visiblePoints = dataPoints.filter((p) => p.timestamp >= startTime);

    if (visiblePoints.length < 2) return;

    const xScale = (timestamp: number) => {
      return padding.left + ((timestamp - startTime) / (now - startTime)) * chartWidth;
    };

    const yScale = (value: number) => {
      const maxValue = Math.max(...visiblePoints.map((p) => p.total));
      return padding.top + (1 - value / maxValue) * chartHeight;
    };

    if (showGrid) {
      ctx.strokeStyle = theme.palette.divider;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);

      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
      }

      for (let i = 0; i <= 5; i++) {
        const x = padding.left + (chartWidth / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    const maxValue = Math.max(...visiblePoints.map((p) => p.total));

    const warningY = yScale(maxValue * warningThreshold);
    ctx.strokeStyle = theme.palette.warning.main;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, warningY);
    ctx.lineTo(padding.left + chartWidth, warningY);
    ctx.stroke();

    const criticalY = yScale(maxValue * criticalThreshold);
    ctx.strokeStyle = theme.palette.error.main;
    ctx.beginPath();
    ctx.moveTo(padding.left, criticalY);
    ctx.lineTo(padding.left + chartWidth, criticalY);
    ctx.stroke();
    ctx.setLineDash([]);

    const categories = Object.keys(categoryColors);
    const paths: { [key: string]: Path2D } = {};

    categories.forEach((category) => {
      paths[category] = new Path2D();
    });

    visiblePoints.forEach((point, index) => {
      const x = xScale(point.timestamp);
      let cumulativeY = 0;

      categories.forEach((category) => {
        const value = point.breakdown?.[category] || 0;
        const y = yScale(cumulativeY + value);

        const path = paths[category];
        if (path) {
          if (index === 0) {
            path.moveTo(x, y);
          } else {
            path.lineTo(x, y);
          }
        }

        cumulativeY += value;
      });
    });

    categories.reverse().forEach((category, index) => {
      const color = categoryColors[category];
      if (!color) return;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;

      const categoryPath = paths[category];
      if (!categoryPath) return;

      const path = new Path2D();
      path.addPath(categoryPath);

      const lastPoint = visiblePoints[visiblePoints.length - 1];
      const firstPoint = visiblePoints[0];

      if (lastPoint && firstPoint) {
        if (index === 0) {
          path.lineTo(xScale(lastPoint.timestamp), padding.top + chartHeight);
          path.lineTo(xScale(firstPoint.timestamp), padding.top + chartHeight);
        } else {
          path.lineTo(xScale(lastPoint.timestamp), yScale(0));
          path.lineTo(xScale(firstPoint.timestamp), yScale(0));
        }
      }

      path.closePath();
      ctx.fill(path);
    });

    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.palette.text.primary;
    ctx.font = '12px sans-serif';

    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      ctx.textAlign = 'right';
      ctx.fillText(formatBytes(value), padding.left - 10, y + 4);
    }

    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const time = startTime + ((now - startTime) / 5) * i;
      const x = padding.left + (chartWidth / 5) * i;
      const date = new Date(time);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      ctx.fillText(label, x, padding.top + chartHeight + 20);
    }

    animationRef.current = requestAnimationFrame(drawChart);
  }, [
    dataPoints,
    timeRange,
    zoomLevel,
    showGrid,
    theme,
    categoryColors,
    warningThreshold,
    criticalThreshold,
  ]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || dataPoints.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const padding = { top: 20, right: 80, bottom: 40, left: 60 };
      const chartWidth = rect.width - padding.left - padding.right;

      if (x >= padding.left && x <= padding.left + chartWidth) {
        const now = Date.now();
        const startTime = now - (timeRange * 1000) / zoomLevel;
        const timestamp = startTime + ((x - padding.left) / chartWidth) * (now - startTime);

        const closestPoint = dataPoints.reduce((prev, curr) => {
          return Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp)
            ? curr
            : prev;
        });

        if (Math.abs(closestPoint.timestamp - timestamp) < 5000) {
          setHoveredPoint({ x, y, data: closestPoint });
        } else {
          setHoveredPoint(null);
        }
      } else {
        setHoveredPoint(null);
      }
    },
    [dataPoints, timeRange, zoomLevel]
  );

  useEffect(() => {
    collectMemoryData();
    const safeInterval = Math.max(updateInterval, 10000);
    intervalRef.current = setInterval(collectMemoryData, safeInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [updateInterval, collectMemoryData]);

  useEffect(() => {
    drawChart();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawChart]);

  return {
    canvasRef,
    dataPoints,
    isPaused,
    isSupported,
    zoomLevel,
    hoveredPoint,
    setHoveredPoint,
    setIsPaused,
    setZoomLevel,
    setDataPoints,
    handleMouseMove,
  };
};
