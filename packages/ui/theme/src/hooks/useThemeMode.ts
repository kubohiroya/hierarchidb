import { useContext } from 'react';

import { ThemeContext } from '../components/ThemeContext.js';
import type { ThemeContextType } from '../types.js';

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    const systemPrefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;

    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ui-theme] useThemeMode invoked outside ThemeProvider; using system preference fallback.');
    }

    return {
      mode: 'system',
      actualTheme: systemPrefersDark ? 'dark' : 'light',
      setMode: () => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[ui-theme] setMode called without ThemeProvider; request ignored.');
        }
      },
    };
  }
  return context;
};
