import { THEME_STORAGE_KEY } from '../constants';
import { ThemeMode } from '../types';

/**
 * Get stored theme mode from localStorage
 */
export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to get theme from localStorage:', error);
  }

  return 'system';
};

/**
 * Store theme mode to localStorage
 */
export const storeThemeMode = (mode: ThemeMode): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('Failed to store theme to localStorage:', error);
  }
};

/**
 * Get system theme preference
 */
export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';

  try {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  } catch (error) {
    console.warn('Failed to get system theme preference:', error);
    return 'light';
  }
};
