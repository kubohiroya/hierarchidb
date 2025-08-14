import { useOIDCAuth } from '../../contexts/OIDCAuthContext';
import { type AuthContext, useBaseAuth } from './useBaseAuth';

const AUTH_CONFIG = {
  redirectUrlKey: 'multi-auth-redirect',
  userStorageKey: 'oidc-auth-user',
};

export function getIdToken(): string | undefined {
  // Return access token for CORS proxy
  const storedUser = localStorage.getItem(AUTH_CONFIG.userStorageKey);
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      return user.access_token;
    } catch (e) {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Unified authentication hook that wraps OIDC Auth Context
 * Provides the same interface as the original useAuthLib hook
 */
export function useAuth() {
  const oidcAuth = useOIDCAuth();

  // Adapt OIDC auth to base auth interface
  const authContext: AuthContext = {
    user: oidcAuth.user,
    isAuthenticated: oidcAuth.isAuthenticated,
    isLoading: oidcAuth.isLoading,
    signIn: (options?: any) => {
      oidcAuth.signIn(options);
    },
    signOut: () => {
      oidcAuth.signOut();
    },
  };

  return useBaseAuth(authContext, AUTH_CONFIG);
}
