import { ReactNode, useEffect, useState } from 'react';

import { ThemeContext } from './ThemeContext';
import { ThemeMode, ThemeContextType } from '../types';
import { getStoredThemeMode, storeThemeMode, getSystemTheme } from '../utils/storage';

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export const ThemeProvider = ({ children, defaultMode = 'system' }: ThemeProviderProps) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(
    () => getStoredThemeMode() || defaultMode
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    storeThemeMode(mode);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const actualTheme = themeMode === 'system' ? systemTheme : themeMode;

  const value: ThemeContextType = {
    mode: themeMode,
    actualTheme,
    setMode: setThemeMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
