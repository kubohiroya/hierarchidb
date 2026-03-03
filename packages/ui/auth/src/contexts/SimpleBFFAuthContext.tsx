import React from 'react';
import { BffKvWarningDialog } from '~/components/BffKvWarningDialog';
import { useSimpleBFFAuthProvider } from './useSimpleBFFAuthProvider';
import type { AuthContextType } from '~/types/AuthContextType';

const SimpleBFFAuthContext = React.createContext<AuthContextType | null>(null);

export function useSimpleBFFAuth() {
  const context = React.useContext(SimpleBFFAuthContext);
  if (!context) {
    // During HMR, the theme might be temporarily unavailable
    // Return a minimal implementation to prevent crashes
    if (import.meta.hot) {
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        signIn: async () => {
          // Auth not ready
        },
        signOut: async () => {
          // Auth not ready
        },
        getAccessToken: () => null,
        getIdToken: () => null,
        currentProvider: 'google' as const,
      };
    }
    throw new Error('useSimpleBFFAuth must be used within SimpleBFFAuthProvider');
  }
  return context;
}

interface SimpleBFFAuthProviderProps {
  children: React.ReactNode;
  homeUrl?: string;
}

export function SimpleBFFAuthProvider({ children, homeUrl = '/' }: SimpleBFFAuthProviderProps) {
  const contextValue = useSimpleBFFAuthProvider({ homeUrl });

  return (
    <SimpleBFFAuthContext.Provider value={contextValue}>
      {children}
      <BffKvWarningDialog />
    </SimpleBFFAuthContext.Provider>
  );
}
