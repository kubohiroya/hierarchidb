import { createContext } from 'react';

import { ThemeContextType } from '../types.js';

export const ThemeContext = createContext<ThemeContextType | null>(null);
