import type { Theme } from '@mui/material/styles';
import { ThemeMode } from '../types';

/**
 * Get theme icon for a given theme mode
 */
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

/**
 * Get theme display name for a given theme mode
 */
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

/**
 * Get background color for theme (compatible with MUI Theme)
 */
export const getBackgroundColorForTheme = (theme: Theme): string => {
  return theme.palette.mode === 'dark'
    ? theme.palette.grey?.[900] || '#121212'
    : theme.palette.grey?.[50] || '#fafafa';
};

/**
 * Get text color for theme (compatible with MUI Theme)
 */
export const getTextColorForTheme = (theme: Theme): string => {
  return theme.palette.mode === 'dark'
    ? theme.palette.grey?.[100] || '#f5f5f5'
    : theme.palette.grey?.[900] || '#212121';
};

/**
 * ページタイプに応じた色を取得
 * 元のgetPageButtonColor関数の簡易版
 */
export function getPageButtonColor(
  pageType: 'projects' | 'resources' | 'preview'
): 'primary' | 'secondary' {
  switch (pageType) {
    case 'projects':
      return 'primary';
    case 'resources':
      return 'secondary';
    default:
      return 'primary';
  }
}
