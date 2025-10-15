/**
 * Consolidated Theme Utilities
 *
 * Combines theme utilities from:
 * - ui-core/ThemedLoadingScreen.tsx (SSR-safe storage & color utilities)
 * - ui-theme/themeUtils.ts (display utilities & MUI integration)
 */

// ========================
// Types
// ========================

export type ThemeMode = 'light' | 'dark' | 'system';

// ========================
// Constants
// ========================

const THEME_STORAGE_KEY = 'src-theme-mode';

// ========================
// Storage & Mode Detection Utilities
// ========================

/**
 * Get stored theme mode from localStorage with safe fallback
 * SSR-compatible: returns 'system' when window is undefined
 */
export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'system' || stored === 'light' || stored === 'dark')) {
      return stored as ThemeMode;
    }
  } catch {
    // Silently fail on localStorage access errors (private mode, etc.)
  }

  return 'system';
};

/**
 * Get system theme preference using matchMedia
 * SSR-compatible: returns 'light' when window is undefined or matchMedia unsupported
 */
export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Get actual theme mode resolving 'system' to light/dark
 */
export const getActualTheme = (): 'light' | 'dark' => {
  const themeMode = getStoredThemeMode();
  return themeMode === 'system' ? getSystemTheme() : themeMode;
};

// ========================
// Color Utilities
// ========================

/**
 * Get background color for current theme
 * SSR-compatible: returns light theme color when window is undefined
 */
export const getThemeBackgroundColor = (): string => {
  // Always return light theme colors during SSR to prevent hydration mismatch
  if (typeof window === 'undefined') {
    return '#fafafa'; // Light theme background
  }

  const theme = getActualTheme();
  return theme === 'dark' ? '#121212' : '#fafafa';
};

/**
 * Get text color for current theme
 * SSR-compatible: returns light theme color when window is undefined
 */
export const getThemeTextColor = (): string => {
  // Always return light theme colors during SSR to prevent hydration mismatch
  if (typeof window === 'undefined') {
    return 'rgba(0, 0, 0, 0.87)'; // Light theme text
  }

  const theme = getActualTheme();
  return theme === 'dark' ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)';
};

// ========================
// Display Utilities
// ========================

/**
 * Get theme icon for a given theme mode
 */
export const getThemeIcon = (mode: ThemeMode): string => {
  switch (mode) {
    case 'light':
      return '☀️';
    case 'dark':
      return '🌙';
    case 'system':
      return '🖥️';
    default:
      return '☀️';
  }
};

/**
 * Get theme display name for a given theme mode
 */
export const getThemeDisplayName = (mode: ThemeMode): string => {
  switch (mode) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    default:
      return 'Light';
  }
};

// ========================
// MUI Theme Integration
// ========================

/**
 * Get background color for theme (compatible with MUI Theme)
 */
export const getBackgroundColorForTheme = (theme: any): string => {
  return theme.palette.mode === 'dark'
    ? theme.palette.grey?.[900] || '#121212'
    : theme.palette.grey?.[50] || '#fafafa';
};

/**
 * Get text color for theme (compatible with MUI Theme)
 */
export const getTextColorForTheme = (theme: any): string => {
  return theme.palette.mode === 'dark'
    ? theme.palette.grey?.[100] || '#f5f5f5'
    : theme.palette.grey?.[900] || '#212121';
};
