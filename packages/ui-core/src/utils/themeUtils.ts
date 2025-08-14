import { ThemeMode } from '../theme/ThemeMode';

export const getThemeIcon = (mode: ThemeMode): string => {
  switch (mode) {
    case 'light':
      return '☀️';
    case 'dark':
      return '🌙';
    case 'system':
      return '🖥️';
    default:
      return '☀️';
  }
};

export const getThemeDisplayName = (mode: ThemeMode): string => {
  switch (mode) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    default:
      return 'Light';
  }
};
