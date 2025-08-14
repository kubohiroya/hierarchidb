import { createContext, useContext } from 'react';
import { ThemeMode } from '@/shared/theme/ThemeMode.ts';
import { ThemeContextType } from '@/shared/theme/ThemeContextType';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

export const getThemeDisplayName = (mode: ThemeMode): string => {
  switch (mode) {
    case 'system':
      return 'System Default';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System Default';
  }
};

export const getThemeIcon = (mode: ThemeMode): string => {
  switch (mode) {
    case 'system':
      return '📱';
    case 'light':
      return '☀️';
    case 'dark':
      return '🌙';
    default:
      return '📱';
  }
};
