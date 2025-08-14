import { ThemeMode } from '@/shared/theme/ThemeMode.ts';
import { THEME_STORAGE_KEY } from '@/shared/theme/THEME_STORAGE_KEY.ts';
// import { devWarn } from "@/shared/utils/logger.ts";

export const storeThemeMode = (mode: ThemeMode): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (error) {
    console.warn('Failed to store theme in localStorage:', error);
  }
};
