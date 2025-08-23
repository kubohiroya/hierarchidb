export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  mode: ThemeMode;
  actualTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}
