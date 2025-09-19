import { formatBytes } from '@hierarchidb/util';

import type { MemoryData } from '../hooks/useMemoryData.js';

/**
  * : Canvas
 * :
 * :
 * : Canvas API
  */

export interface CanvasRenderOptions {
  width: number;
  height: number;
  theme: {
    palette: {
      divider: string;
      warning: { main: string };
      error: { main: string };
      text: { primary: string };
    };
  };
  categoryColors: { [key: string]: string };
  warningThreshold: number;
  criticalThreshold: number;
  showGrid: boolean;
  showAxes: boolean;
}

export interface ChartDataPoint {
  timestamp: number;
  memoryData: MemoryData;
}

/**
  * : Canvas
 * :
 * :
 * : Canvas API
  */
export class CanvasRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dataPoints: ChartDataPoint[] = [];
  private animationId: number | null = null;

  /**
      * : Canvas
   * :
   * : Canvas API
      */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    if (!this.ctx) {
      throw new Error('Unable to get 2D rendering context from canvas');
    }

    //  Retina: DPI
    this.setupHighDPI();
  }

  /**
      * : Retina/DPI
   * :
   * :
   * : CanvasDPI
      */
  private setupHighDPI(): void {
    if (!this.canvas || !this.ctx) return;

    //  DPR:
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    //  Canvas:
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    //  :
    this.ctx.scale(dpr, dpr);

    //  CSS:
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
      * :
   * :
   * :
   * :
      */
  addDataPoint(memoryData: MemoryData, maxDataPoints: number = 100): void {
    //  :
    this.dataPoints.push({
      timestamp: Date.now(),
      memoryData,
    });

    //  :
    if (this.dataPoints.length > maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(-maxDataPoints);
    }
  }

  /**
      * :
   * :
   * :
      */
  clearData(): void {
    this.dataPoints = [];
  }

  /**
      * :
   * :
   * :
   * :
      */
  render(options: CanvasRenderOptions): void {
    if (!this.canvas || !this.ctx || this.dataPoints.length === 0) return;

    try {
      //  : Canvas
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);

      //  :
      const padding = { top: 20, right: 80, bottom: 40, left: 60 };
      const chartWidth = rect.width - padding.left - padding.right;
      const chartHeight = rect.height - padding.top - padding.bottom;

      //  :
      if (options.showGrid) {
        this.drawGrid(padding, chartWidth, chartHeight, options);
      }

      this.drawThresholdLines(padding, chartWidth, chartHeight, options);
      this.drawChart(padding, chartWidth, chartHeight, options);

      if (options.showAxes) {
        this.drawAxes(padding, chartWidth, chartHeight, options);
      }
    } catch (error) {
      //  :
      console.warn('Canvas rendering failed:', error);
    }
  }

  /**
      * :
   * :
   * :
   * : Canvas
      */
  private drawGrid(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions,
  ): void {
    if (!this.ctx) return;

    //  :
    this.ctx.strokeStyle = options.theme.palette.divider;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([2, 2]);

    //  : Y
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();
    }

    //  : X
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, padding.top + chartHeight);
      this.ctx.stroke();
    }

    //  :
    this.ctx.setLineDash([]);
  }

  /**
      * :
   * :
   * :
   * :
      */
  private drawThresholdLines(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions,
  ): void {
    if (!this.ctx || this.dataPoints.length === 0) return;

    //  :
    const maxValue = Math.max(...this.dataPoints.map((p) => p.memoryData.total));
    if (maxValue === 0) return;

    //  :
    const warningY = padding.top + (1 - options.warningThreshold) * chartHeight;
    this.ctx.strokeStyle = options.theme.palette.warning.main;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, warningY);
    this.ctx.lineTo(padding.left + chartWidth, warningY);
    this.ctx.stroke();

    //  :
    const criticalY = padding.top + (1 - options.criticalThreshold) * chartHeight;
    this.ctx.strokeStyle = options.theme.palette.error.main;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, criticalY);
    this.ctx.lineTo(padding.left + chartWidth, criticalY);
    this.ctx.stroke();

    //  :
    this.ctx.setLineDash([]);
  }

  /**
      * :
   * :
   * :
   * :
      */
  private drawChart(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions,
  ): void {
    if (!this.ctx || this.dataPoints.length < 2) return;

    //  : X
    const now = Date.now();
    const timeRange = 5 * 60 * 1000; //  5
    const startTime = now - timeRange;

    //  :
    const visiblePoints = this.dataPoints.filter((p) => p.timestamp >= startTime);
    if (visiblePoints.length < 2) return;

    //  :
    const xScale = (timestamp: number) => {
      return padding.left + ((timestamp - startTime) / timeRange) * chartWidth;
    };

    const yScale = (percentage: number) => {
      return padding.top + (1 - percentage / 100) * chartHeight;
    };

    //  :
    this.ctx.strokeStyle = options.categoryColors.JavaScript || '#F7DF1E';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    visiblePoints.forEach((point, index) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.memoryData.percentage);

      if (index === 0) {
        this.ctx!.moveTo(x, y);
      } else {
        this.ctx!.lineTo(x, y);
      }
    });

    this.ctx.stroke();

    //  :
    this.ctx.fillStyle = options.categoryColors.JavaScript || '#F7DF1E';
    visiblePoints.forEach((point) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.memoryData.percentage);

      this.ctx!.beginPath();
      this.ctx!.arc(x, y, 3, 0, 2 * Math.PI);
      this.ctx!.fill();
    });
  }

  /**
      * : XY
   * :
   * :
   * :
      */
  private drawAxes(
    padding: { top: number; right: number; bottom: number; left: number },
    chartWidth: number,
    chartHeight: number,
    options: CanvasRenderOptions,
  ): void {
    if (!this.ctx || this.dataPoints.length === 0) return;

    //  :
    this.ctx.fillStyle = options.theme.palette.text.primary;
    this.ctx.font = '12px sans-serif';

    //  Y:
    const maxValue = Math.max(...this.dataPoints.map((p) => p.memoryData.total));
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * (4 - i);
      const y = padding.top + (chartHeight / 4) * i;
      this.ctx.textAlign = 'right';
      this.ctx.fillText(formatBytes(value), padding.left - 10, y + 4);
    }

    //  X:
    const now = Date.now();
    const timeRange = 5 * 60 * 1000; //  5
    const startTime = now - timeRange;

    this.ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const time = startTime + (timeRange / 5) * i;
      const x = padding.left + (chartWidth / 5) * i;
      const date = new Date(time);
      const label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      this.ctx.fillText(label, x, padding.top + chartHeight + 20);
    }
  }

  /**
      * : Canvas
   * :
   * :
   * :
      */
  dispose(): void {
    //  :
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    //  : Canvas
    this.canvas = null;
    this.ctx = null;
    this.dataPoints = [];
  }
}
