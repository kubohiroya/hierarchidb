import { useContext } from 'react';

import { ThemeContext } from '~/components/ThemeContext';
import { ThemeContextType } from '~/types';

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};