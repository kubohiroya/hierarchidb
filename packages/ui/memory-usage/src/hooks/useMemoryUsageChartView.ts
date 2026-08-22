import type { Theme } from '@mui/material';
import { useCallback, useEffect, useRef } from 'react';
import { CanvasRenderer } from '../services/CanvasRenderer.js';
import { useMemoryData } from './useMemoryData.js';

type MemoryUsageChartVariant = 'simple' | 'detailed' | 'compact';

type UseMemoryUsageChartViewArgs = {
  variant: MemoryUsageChartVariant;
  height: number;
  updateInterval: number;
  maxDataPoints: number;
  categoryColors: { [key: string]: string };
  warningThreshold: number;
  criticalThreshold: number;
  showGrid: boolean;
  maxMemory: number;
  theme: Theme;
};

export const useMemoryUsageChartView = ({
  variant,
  height,
  updateInterval,
  maxDataPoints,
  categoryColors,
  warningThreshold,
  criticalThreshold,
  showGrid,
  maxMemory,
  theme,
}: UseMemoryUsageChartViewArgs) => {
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
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    } catch (canvasError) {
      console.error('Failed to initialize canvas renderer:', canvasError);
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
    } catch (renderError) {
      console.warn('Chart rendering failed:', renderError);
    }
  }, [
    memoryData,
    maxDataPoints,
    theme,
    categoryColors,
    warningThreshold,
    criticalThreshold,
    showGrid,
  ]);

  const handleClearData = useCallback(() => {
    clearMemoryData();
    if (rendererRef.current) {
      rendererRef.current.clearData();
    }
  }, [clearMemoryData]);

  const componentHeight = (() => {
    switch (variant) {
      case 'compact':
        return typeof height === 'number' ? height * 0.6 : 180;
      case 'simple':
        return typeof height === 'number' ? height * 0.8 : 240;
      default:
        return height;
    }
  })();

  const usageColor =
    memoryData.percentage > criticalThreshold * 100
      ? 'error.main'
      : memoryData.percentage > warningThreshold * 100
        ? 'warning.main'
        : 'text.primary';

  return {
    canvasRef,
    memoryData,
    isSupported,
    isPaused,
    togglePause,
    handleClearData,
    error,
    componentHeight,
    usageColor,
  };
};
