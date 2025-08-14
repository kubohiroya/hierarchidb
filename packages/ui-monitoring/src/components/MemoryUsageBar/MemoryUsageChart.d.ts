import React from 'react';
interface MemoryUsageChartProps {
  /** チャートの幅 */
  width?: string | number;
  /** チャートの高さ */
  height?: number;
  /** データ収集間隔（ミリ秒） */
  updateInterval?: number;
  /** 表示する時間範囲（秒） */
  timeRange?: number;
  /** 最大データポイント数 */
  maxDataPoints?: number;
  /** カテゴリー別の色 */
  categoryColors?: {
    [key: string]: string;
  };
  /** 警告しきい値（0-1） */
  warningThreshold?: number;
  /** 危険しきい値（0-1） */
  criticalThreshold?: number;
  /** グリッド線を表示するか */
  showGrid?: boolean;
  /** 凡例を表示するか */
  showLegend?: boolean;
  /** 最大メモリサイズ（バイト） */
  maxMemory?: number;
}
/**
 * メモリ使用量の時系列積み上げ面グラフコンポーネント
 */
export declare const MemoryUsageChart: React.FC<MemoryUsageChartProps>;
export {};
//# sourceMappingURL=MemoryUsageChart.d.ts.map
