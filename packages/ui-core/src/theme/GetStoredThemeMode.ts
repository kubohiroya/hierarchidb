import { ThemeMode } from '@/shared/theme/ThemeMode.ts';
// import { devWarn } from "@/shared/utils/logger.ts";
import { THEME_STORAGE_KEY } from './THEME_STORAGE_KEY';

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (stored === 'system' || stored === 'light' || stored === 'dark')) {
      return stored as ThemeMode;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }

  return 'system';
};
