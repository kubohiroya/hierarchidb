import { ThemeMode } from './ThemeMode';

export const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return isDark ? 'dark' : 'light';
};
