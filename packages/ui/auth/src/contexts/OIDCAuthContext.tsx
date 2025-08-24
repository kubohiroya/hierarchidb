import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from 'react-oidc-context';
// import { getSecureConfig } from "@/config/secureConfig";
const getSecureConfig = () => ({
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY || '',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID || '',
  oidcScope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
});
// import { notify } from "@/shared/containers/NotificationSystem/NotificationSystem";
const notify = {
  error: (msg: string) => console.error(msg),
  success: (msg: string) => console.log(msg),
};

// import { devError } from "@/shared/utils/logger";
const devError = (msg: string, error?: any) => console.error(msg, error);
import { AuthContextType } from '../types/AuthContextType';
import { AuthUser } from '../types/AuthUser';

const OIDCAuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'oidc-auth-user';
const REDIRECT_URL_KEY = 'oidc-auth-redirect';

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
  const auth = useAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert OIDC user to our AuthUser format
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      const authUser: AuthUser = {
        id: auth.user.profile.sub || '',
        email: auth.user.profile.email || '',
        name: auth.user.profile.name || '',
        picture: auth.user.profile.picture,
        provider: 'google',
        access_token: auth.user.access_token || '',
        id_token: auth.user.id_token,
        expires_at: (auth.user.expires_at || 0) * 1000, // Convert to milliseconds
      };

      setUser(authUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    } else {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    setIsLoading(auth.isLoading);
  }, [auth.isAuthenticated, auth.user, auth.isLoading]);

  // Handle authentication errors
  useEffect(() => {
    if (auth.error) {
      devError(`OIDC Authentication error:${auth.error}`);
      notify.error('Authentication failed. Please try again.');
    }
  }, [auth.error]);

  const signIn = useCallback(
    (options?: { returnUrl?: string }) => {
      // Store return URL if provided
      if (options?.returnUrl) {
        localStorage.setItem(REDIRECT_URL_KEY, options.returnUrl);
      } else {
        const currentUrl = window.location.pathname + window.location.search;
        localStorage.setItem(REDIRECT_URL_KEY, currentUrl);
      }

      auth.signinRedirect();
    },
    [auth]
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REDIRECT_URL_KEY);
    setUser(null);

    try {
      await auth.signoutRedirect();
    } catch (error) {
      devError(`Logout error: ${error}`);
      // Fallback: redirect to home page
      window.location.href = fallbackPath;
    }
  }, [auth]);

  const getAccessToken = useCallback(() => {
    if (!user || !auth.user) return null;

    // Check if token is expired
    const now = Date.now() / 1000; // Convert to seconds
    if ((auth.user.expires_at || 0) <= now) {
      return null;
    }

    return user.access_token;
  }, [user, auth.user]);

  const getIdToken = useCallback(() => {
    return user?.id_token || null;
  }, [user]);

  // Handle successful authentication redirect
  useEffect(() => {
    if (auth.isAuthenticated && user) {
      const redirectUrl = localStorage.getItem(REDIRECT_URL_KEY);
      if (redirectUrl) {
        localStorage.removeItem(REDIRECT_URL_KEY);
        window.location.href = redirectUrl;
      }
    }
  }, [auth.isAuthenticated, user]);

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: auth.isAuthenticated,
    isLoading,
    signIn,
    signOut,
    getAccessToken,
    getIdToken,
    currentProvider: 'google',
  };

  return <OIDCAuthContext.Provider value={contextValue}>{children}</OIDCAuthContext.Provider>;
}

interface OIDCAuthProviderProps {
  fallbackPath: string; // "/eria-cartograph"
  children: React.ReactNode;
}
export function OIDCAuthProvider({ fallbackPath, children }: OIDCAuthProviderProps) {
  const secureConfig = getSecureConfig();

  // BFF configuration
  const bffBaseUrl = import.meta.env.VITE_BFF_BASE_URL || 'http://localhost:8787';

  const oidcConfig = {
    authority: bffBaseUrl,
    client_id: secureConfig.oidcClientId || '',
    redirect_uri: `${window.location.origin}${fallbackPath}/auth/callback`,
    scope: 'openid profile email',
    response_type: 'code',

    // PKCE configuration
    code_challenge_method: 'S256',

    // Custom endpoints via BFF
    metadata: {
      authorization_endpoint: `${bffBaseUrl}/auth/google/authorize`,
      token_endpoint: `${bffBaseUrl}/auth/google/callback`,
      userinfo_endpoint: `${bffBaseUrl}/auth/userinfo`,
      end_session_endpoint: `${bffBaseUrl}/auth/logout`,
    },

    // Error handling
    loadUserInfo: true,
    automaticSilentRenew: false,

    // Custom request handling for BFF integration
    extraQueryParams: {},
    extraTokenParams: {},
  };

  if (!secureConfig.oidcClientId) {
    devError('Google Client ID is not configured');
    // Return a placeholder theme when clientId is missing
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
