// import { type AuthContext, useBaseAuth } from "./useBaseAuth";
type AuthContext = {
  user: any;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

import { useGoogleAuth } from '../../contexts/GoogleAuthContext';

const AUTH_CONFIG = {
  redirectUrlKey: 'google-auth-redirect',
  userStorageKey: 'google-auth-user',
};

export function getIdToken(): string | undefined {
  // Return Google access token for CORS proxy
  // The CORS proxy now supports both JWT ID tokens and Google access tokens
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
 * Unified authentication hook that wraps Google Auth
 * Provides the same interface as the original useAuthLib hook
 */
export function useAuth() {
  const googleAuth = useGoogleAuth();

  // Adapt Google auth to base auth interface
  const authContext: AuthContext = {
    user: googleAuth.user,
    isAuthenticated: googleAuth.isAuthenticated,
    isLoading: googleAuth.isLoading,
    signIn: () => Promise.resolve(googleAuth.signIn()),
    signOut: () => Promise.resolve(googleAuth.signOut()),
  };

  return authContext;
}
