import { createContext } from 'react';

import type { ThemeContextType } from '../types.js';

export const ThemeContext = createContext<ThemeContextType | null>(null);
