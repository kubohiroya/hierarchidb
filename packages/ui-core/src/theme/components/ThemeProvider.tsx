import React, { ReactNode, useEffect, useState } from 'react';
import { ThemeMode } from '@/shared/theme/ThemeMode';
import { getStoredThemeMode } from '@/shared/theme/GetStoredThemeMode.ts';
import { getSystemTheme } from '@/shared/theme/GetSystemTheme.ts';
import { storeThemeMode } from '@/shared/theme/StoreThemeMode';
import { ThemeContextType } from '@/shared/theme/ThemeContextType';
import { ThemeContext } from './ThemeContext';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  const actualTheme = themeMode === 'system' ? systemTheme : themeMode;

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

  const value: ThemeContextType = {
    themeMode,
    actualTheme,
    setThemeMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
