import { AccordionTheme, defaultAccordionTheme } from '../types';

/**
 * Get phase color based on theme mode
 */
export function getPhaseColor(
  phase: number, 
  isDark: boolean, 
  theme: AccordionTheme = defaultAccordionTheme
): string {
  const colors = isDark ? theme.phaseColorsDark : theme.phaseColorsLight;
  return colors[phase] || colors[1] || (isDark ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5');
}

/**
 * Create a custom theme with specified colors
 */
export function createAccordionTheme(
  lightColors: Record<number, string>,
  darkColors?: Record<number, string>
): AccordionTheme {
  return {
    phaseColorsLight: lightColors,
    phaseColorsDark: darkColors || lightColors,
  };
}

/**
 * Format byte size to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get hardware concurrency with fallback
 */
export function getHardwareConcurrency(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  return 4; // Reasonable default
}

/**
 * Validate concurrency value
 */
export function validateConcurrency(value: number, min = 1, max = 16): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Get accordion phase colors for a specific theme
 */
export function getAccordionPhaseColors(theme: 'light' | 'dark'): Record<number, string> {
  return theme === 'dark' ? defaultAccordionTheme.phaseColorsDark : defaultAccordionTheme.phaseColorsLight;
}

/**
 * Format cache size to human readable format (alias for formatBytes)
 */
export const formatCacheSize = formatBytes;

/**
 * Format item count
 */
export function formatItemCount(count: number): string {
  return `${count} item${count !== 1 ? 's' : ''}`;
}

/**
 * Detect hardware concurrency (alias for getHardwareConcurrency)
 */
export const detectHardwareConcurrency = getHardwareConcurrency;

/**
 * Validate concurrency value (alias for validateConcurrency)
 */
export const validateConcurrencyValue = validateConcurrency;