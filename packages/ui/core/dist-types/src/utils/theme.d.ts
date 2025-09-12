/**
 * Consolidated Theme Utilities
 *
 * Combines theme utilities from:
 * - ui-core/ThemedLoadingScreen.tsx (SSR-safe storage & color utilities)
 * - ui-theme/themeUtils.ts (display utilities & MUI integration)
 */
export type ThemeMode = 'light' | 'dark' | 'system';
/**
 * Get stored theme mode from localStorage with safe fallback
 * SSR-compatible: returns 'system' when window is undefined
 */
export declare const getStoredThemeMode: () => ThemeMode;
/**
 * Get system theme preference using matchMedia
 * SSR-compatible: returns 'light' when window is undefined or matchMedia unsupported
 */
export declare const getSystemTheme: () => 'light' | 'dark';
/**
 * Get actual theme mode resolving 'system' to light/dark
 */
export declare const getActualTheme: () => 'light' | 'dark';
/**
 * Get background color for current theme
 * SSR-compatible: returns light theme color when window is undefined
 */
export declare const getThemeBackgroundColor: () => string;
/**
 * Get text color for current theme
 * SSR-compatible: returns light theme color when window is undefined
 */
export declare const getThemeTextColor: () => string;
/**
 * Get theme icon for a given theme mode
 */
export declare const getThemeIcon: (mode: ThemeMode) => string;
/**
 * Get theme display name for a given theme mode
 */
export declare const getThemeDisplayName: (mode: ThemeMode) => string;
/**
 * Get background color for theme (compatible with MUI Theme)
 */
export declare const getBackgroundColorForTheme: (theme: any) => string;
/**
 * Get text color for theme (compatible with MUI Theme)
 */
export declare const getTextColorForTheme: (theme: any) => string;
//# sourceMappingURL=theme.d.ts.map