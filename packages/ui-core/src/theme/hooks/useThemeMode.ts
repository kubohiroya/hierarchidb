import { useContext } from 'react';
import { ThemeContext } from '../components/ThemeContext';
import { ThemeMode } from '../ThemeMode';

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};

export const getThemeIcon = (mode: ThemeMode) => {
  switch (mode) {
    case ThemeMode.LIGHT:
      return '☀️';
    case ThemeMode.DARK:
      return '🌙';
    case ThemeMode.SYSTEM:
      return '💻';
    default:
      return '🎨';
  }
};

export const getThemeDisplayName = (mode: ThemeMode) => {
  switch (mode) {
    case ThemeMode.LIGHT:
      return 'Light';
    case ThemeMode.DARK:
      return 'Dark';
    case ThemeMode.SYSTEM:
      return 'System';
    default:
      return 'Custom';
  }
};
