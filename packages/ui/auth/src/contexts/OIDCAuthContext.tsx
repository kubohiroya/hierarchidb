import { createContext, useContext } from 'react';
import { AuthProvider } from 'react-oidc-context';
import type { AuthContextType } from '~/types/AuthContextType';
import { useOIDCAuthProviderContext } from './useOIDCAuthProviderContext.js';

const getSecureConfig = () => ({
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY || '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
  oidcScope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
});

const notify = {
  error: (msg: string) => console.error(msg),
};

const OIDCAuthContext = createContext<AuthContextType | null>(null);

export function useOIDCAuth() {
  const context = useContext(OIDCAuthContext);
  if (!context) {
    throw new Error('useOIDCAuth must be used within OIDCAuthProvider');
  }
  return context;
}

interface OIDCAuthProviderInnerProps {
  fallbackPath: string;
  children: React.ReactNode;
}

function OIDCAuthProviderInner({ fallbackPath, children }: OIDCAuthProviderInnerProps) {
  const { contextValue } = useOIDCAuthProviderContext({ fallbackPath });

  return <OIDCAuthContext.Provider value={contextValue}>{children}</OIDCAuthContext.Provider>;
}

interface OIDCAuthProviderProps {
  fallbackPath: string;
  children: React.ReactNode;
}

export function OIDCAuthProvider({ fallbackPath, children }: OIDCAuthProviderProps) {
  const secureConfig = getSecureConfig();

  const bffBaseUrl = import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

  const oidcConfig = {
    authority: bffBaseUrl,
    client_id: secureConfig.oidcClientId || '',
    redirect_uri: `${window.location.origin}${fallbackPath}/auth/callback`,
    scope: 'openid profile email',
    response_type: 'code',
    code_challenge_method: 'S256',
    metadata: {
      authorization_endpoint: `${bffBaseUrl}/auth/authorize/google`,
      token_endpoint: `${bffBaseUrl}/auth/google/callback`,
      userinfo_endpoint: `${bffBaseUrl}/auth/userinfo`,
      end_session_endpoint: `${bffBaseUrl}/auth/logout`,
    },
    loadUserInfo: true,
    automaticSilentRenew: false,
    extraQueryParams: {},
    extraTokenParams: {},
  };

  if (!secureConfig.oidcClientId) {
    if (import.meta.env.DEV) {
      console.error('Google Client ID is not configured');
    }
    return (
      <OIDCAuthContext.Provider
        value={{
          user: null,
          isAuthenticated: false,
          isLoading: false,
          signIn: () => notify.error('Cannot sign in: Client ID is missing'),
          signOut: async () => {
            /* no-op */
          },
          getAccessToken: () => null,
          getIdToken: () => null,
          currentProvider: null,
        }}
      >
        {children}
      </OIDCAuthContext.Provider>
    );
  }

  return (
    <AuthProvider {...oidcConfig}>
      <OIDCAuthProviderInner fallbackPath={fallbackPath}>{children}</OIDCAuthProviderInner>
    </AuthProvider>
  );
}
