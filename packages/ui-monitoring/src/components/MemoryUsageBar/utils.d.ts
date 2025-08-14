/**
 * メモリ使用量関連のユーティリティ関数
 */
/**
 * パーセンテージを0-100の範囲に制限
 * @param percentage パーセンテージ値
 * @returns 0-100の範囲に制限された値
 */
export declare const clampPercentage: (percentage: number) => number;
/**
 * メモリ使用量の重要度を判定
 * @param percentage 使用率（0-100）
 * @param warningThreshold 警告しきい値
 * @param criticalThreshold 危険しきい値
 * @returns 重要度レベル
 */
export declare const getMemorySeverity: (
  percentage: number,
  warningThreshold?: number,
  criticalThreshold?: number
) => 'normal' | 'warning' | 'critical';
//# sourceMappingURL=utils.d.ts.map
