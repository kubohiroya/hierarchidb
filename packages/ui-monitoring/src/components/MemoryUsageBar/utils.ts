/**
 * メモリ使用量関連のユーティリティ関数
 */

/**
 * パーセンテージを0-100の範囲に制限
 * @param percentage パーセンテージ値
 * @returns 0-100の範囲に制限された値
 */
export const clampPercentage = (percentage: number): number => {
  return Math.max(0, Math.min(100, percentage));
};

/**
 * メモリ使用量の重要度を判定
 * @param percentage 使用率（0-100）
 * @param warningThreshold 警告しきい値
 * @param criticalThreshold 危険しきい値
 * @returns 重要度レベル
 */
export const getMemorySeverity = (
  percentage: number,
  warningThreshold = 70,
  criticalThreshold = 90
): 'normal' | 'warning' | 'critical' => {
  if (percentage >= criticalThreshold) return 'critical';
  if (percentage >= warningThreshold) return 'warning';
  return 'normal';
};
