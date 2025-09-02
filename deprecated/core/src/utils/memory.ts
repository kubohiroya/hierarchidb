/**
 * Memory usage utilities for monitoring and formatting
 */

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const n = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return `${n} ${sizes[i]}`;
}

/**
 * Clamp percentage to 0-100 range
 * @param percentage Percentage value
 * @returns Value clamped to 0-100 range
 */
export const clampPercentage = (percentage: number): number => {
  return Math.max(0, Math.min(100, percentage));
};

/**
 * Determine memory usage severity level
 * @param percentage Usage percentage (0-100)
 * @param warningThreshold Warning threshold
 * @param criticalThreshold Critical threshold
 * @returns Severity level
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
