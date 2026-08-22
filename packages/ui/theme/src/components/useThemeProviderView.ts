import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeContextType, ThemeMode } from '~/types';
import { getStoredThemeMode, getSystemTheme, storeThemeMode } from '~/utils/storage';

export interface UseThemeProviderViewParams {
  defaultMode: ThemeMode;
}

export interface UseThemeProviderViewResult {
  value: ThemeContextType;
}

export function useThemeProviderView({
  defaultMode,
}: UseThemeProviderViewParams): UseThemeProviderViewResult {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () => getStoredThemeMode() || defaultMode
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    storeThemeMode(mode);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const actualTheme = themeMode === 'system' ? systemTheme : themeMode;
  const value = useMemo<ThemeContextType>(
    () => ({
      mode: themeMode,
      actualTheme,
      setMode: setThemeMode,
    }),
    [actualTheme, setThemeMode, themeMode]
  );

  return {
    value,
  };
}
