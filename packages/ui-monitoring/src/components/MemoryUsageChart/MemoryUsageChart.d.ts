import React from 'react';
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
/**
 * メモリ使用量を折れ線グラフで表示するコンポーネント
 */
export declare const MemoryUsageChart: React.FC<MemoryUsageChartProps>;
export {};
//# sourceMappingURL=MemoryUsageChart.d.ts.map
