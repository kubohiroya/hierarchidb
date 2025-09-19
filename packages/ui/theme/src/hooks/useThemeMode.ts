import { useContext } from 'react';

import { ThemeContext } from '../components/ThemeContext.js';
import { ThemeContextType } from '../types.js';

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};
