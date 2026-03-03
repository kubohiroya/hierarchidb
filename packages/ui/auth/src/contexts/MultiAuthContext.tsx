import { createContext, useContext } from 'react';
import type { AuthContextType } from '~/types/AuthContextType';
import { useMultiAuthProviderContext } from './useMultiAuthProviderContext.js';

const MultiAuthContext = createContext<AuthContextType | null>(null);

export function useMultiAuth() {
  const context = useContext(MultiAuthContext);
  if (!context) {
    throw new Error('useMultiAuth must be used within MultiAuthProvider');
  }
  return context;
}

interface MultiAuthProviderProps {
  children: React.ReactNode;
  homeUrl?: string;
}

export function MultiAuthProvider({ children, homeUrl = '/' }: MultiAuthProviderProps) {
  const { contextValue } = useMultiAuthProviderContext({ homeUrl });

  return <MultiAuthContext.Provider value={contextValue}>{children}</MultiAuthContext.Provider>;
}
