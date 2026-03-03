import { useEffect, useRef } from 'react';
import type { MemoryUsageChartDataPoint } from './useMemoryUsageChartData.js';

export interface UseMemoryUsageChartCanvasParams {
  dataPoints: MemoryUsageChartDataPoint[];
  warningThreshold: number;
  criticalThreshold: number;
  maxDataPoints: number;
  palette: {
    divider: string;
    warningMain: string;
    errorMain: string;
    primaryMain: string;
  };
}

export interface UseMemoryUsageChartCanvasResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const hexToRgba = (hex: string, alpha: number) => {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function useMemoryUsageChartCanvas({
  dataPoints,
  warningThreshold,
  criticalThreshold,
  maxDataPoints,
  palette,
}: UseMemoryUsageChartCanvasParams): UseMemoryUsageChartCanvasResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dataPoints.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = palette.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    for (let i = 0; i <= 4; i += 1) {
      const y = (rect.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const warningY = rect.height * (1 - warningThreshold);
    const criticalY = rect.height * (1 - criticalThreshold);
    ctx.strokeStyle = palette.warningMain;
    ctx.beginPath();
    ctx.moveTo(0, warningY);
    ctx.lineTo(rect.width, warningY);
    ctx.stroke();
    ctx.strokeStyle = palette.errorMain;
    ctx.beginPath();
    ctx.moveTo(0, criticalY);
    ctx.lineTo(rect.width, criticalY);
    ctx.stroke();

    const xStep = rect.width / (maxDataPoints - 1);
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, hexToRgba(palette.primaryMain, 0.6));
    gradient.addColorStop(1 - criticalThreshold, hexToRgba(palette.primaryMain, 0.6));
    gradient.addColorStop(1 - warningThreshold, hexToRgba(palette.warningMain, 0.6));
    gradient.addColorStop(1, hexToRgba(palette.errorMain, 0.6));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, rect.height);
    dataPoints.forEach((point, index) => {
      const x = index * xStep;
      const y = rect.height * (1 - point.percentage / 100);
      ctx.lineTo(x, y);
    });
    ctx.lineTo((dataPoints.length - 1) * xStep, rect.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.primaryMain;
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

    ctx.fillStyle = palette.primaryMain;
    dataPoints.forEach((point, index) => {
      const x = index * xStep;
      const y = rect.height * (1 - point.percentage / 100);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [criticalThreshold, dataPoints, maxDataPoints, palette, warningThreshold]);

  return { canvasRef };
}
