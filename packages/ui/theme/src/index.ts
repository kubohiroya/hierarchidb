// Types
export type { ThemeMode, ThemeContextType } from './types';

// Constants
export { THEME_STORAGE_KEY, RAINBOW_COLORS } from './constants';

// Theme creation
export { createAppTheme, default as defaultTheme } from './theme/createTheme';

// Components
export { ThemeContext } from './components/ThemeContext';
export { ThemeProvider } from './components/ThemeProvider';
export type { ThemeProviderProps } from './components/ThemeProvider';

// Hooks
export { useThemeMode } from './hooks/useThemeMode';

// Utils - Re-export from ui-core to avoid duplication
export {
  getThemeIcon,
  getThemeDisplayName,
  getBackgroundColorForTheme,
  getTextColorForTheme,
} from '@hierarchidb/ui-core';

export { getStoredThemeMode, storeThemeMode, getSystemTheme } from './utils/storage';
