import { ThemeMode } from './ThemeMode';

export interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}
