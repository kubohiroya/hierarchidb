import { GoogleOAuthProvider } from '@react-oauth/google';
import { createContext, useContext } from 'react';
import {
  type GoogleAuthContextType,
  useGoogleAuthProviderContext,
} from './useGoogleAuthProviderContext.js';

const GoogleAuthContext = createContext<GoogleAuthContextType | null>(null);

export function useGoogleAuth() {
  const context = useContext(GoogleAuthContext);
  if (!context) {
    throw new Error('useGoogleAuth must be used within GoogleAuthProvider');
  }
  return context;
}

interface GoogleAuthProviderInnerProps {
  children: React.ReactNode;
  homeUrl: string;
}

function GoogleAuthProviderInner({ children, homeUrl }: GoogleAuthProviderInnerProps) {
  const { contextValue } = useGoogleAuthProviderContext({ homeUrl });

  return <GoogleAuthContext.Provider value={contextValue}>{children}</GoogleAuthContext.Provider>;
}

interface GoogleAuthProviderProps {
  children: React.ReactNode;
  clientId: string;
  homeUrl?: string;
}

export function GoogleAuthProvider({ children, clientId, homeUrl = '/' }: GoogleAuthProviderProps) {
  if (!clientId) {
    console.error('Google OAuth Client ID is required');
    return (
      <GoogleAuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          signIn: () => console.error('Cannot sign in: Client ID is missing'),
          signOut: () => {
            /* no-op */
          },
          getAccessToken: () => null,
          getIdToken: () => null,
        }}
      >
        {children}
      </GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleAuthProviderInner homeUrl={homeUrl}>{children}</GoogleAuthProviderInner>
    </GoogleOAuthProvider>
  );
}
