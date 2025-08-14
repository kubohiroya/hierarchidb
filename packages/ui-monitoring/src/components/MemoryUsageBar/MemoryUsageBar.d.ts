import React from 'react';
export interface MemoryUsageBarProps {
  /** 幅 (例: '300px', '100%') */
  width?: string | number;
  /** 高さ (例: '40px') */
  height?: string | number;
  /** 更新間隔（ミリ秒） */
  updateInterval?: number;
  /** 使用量の警告しきい値（0-1） */
  warningThreshold?: number;
  /** 使用量の危険しきい値（0-1） */
  criticalThreshold?: number;
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** 数値を表示するか */
  showValues?: boolean;
  /** コンパクトモード */
  compact?: boolean;
  /** 最大メモリサイズ（バイト）- 自動検出できない場合のフォールバック */
  maxMemory?: number;
}
/**
 * メモリ使用量を帯グラフで表示するコンポーネント
 *
 * performance.measureUserAgentSpecificMemory() APIを使用して
 * より詳細なメモリ使用状況を監視し、視覚的に表示します。
 */
export declare const MemoryUsageBar: React.FC<MemoryUsageBarProps>;
//# sourceMappingURL=MemoryUsageBar.d.ts.map
