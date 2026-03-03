import { type ReactNode } from 'react';

import { ThemeContext } from '~/components/ThemeContext';
import type { ThemeMode } from '~/types';
import { useThemeProviderView } from './useThemeProviderView';

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export const ThemeProvider = ({ children, defaultMode = 'system' }: ThemeProviderProps) => {
  const { value } = useThemeProviderView({ defaultMode });

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
