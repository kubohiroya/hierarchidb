/**
 * Formatting utilities for various data types
 */

/**
 * Format bytes to human-readable format
 * @param bytes Number of bytes
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const n = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${n} ${sizes[i]}`;
}

/**
 * Clamp percentage to 0-100 range
 * @param percentage Percentage value
 * @returns Value clamped to 0-100 range
 */
export function clampPercentage(percentage: number): number {
  return Math.max(0, Math.min(100, percentage));
}

/**
 * Determine memory usage severity level
 * @param percentage Usage percentage (0-100)
 * @param warningThreshold Warning threshold (default: 70)
 * @param criticalThreshold Critical threshold (default: 90)
 * @returns Severity level
 */
export function getMemorySeverity(
  percentage: number,
  warningThreshold = 70,
  criticalThreshold = 90
): 'normal' | 'warning' | 'critical' {
  if (percentage >= criticalThreshold) return 'critical';
  if (percentage >= warningThreshold) return 'warning';
  return 'normal';
}