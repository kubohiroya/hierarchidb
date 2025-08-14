/**
 * @file useBaseAuth - Base authentication hook with common functionality
 * @module shared/auth/hooks
 */

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
// import { APP_PREFIX } from "@/config/appDescription"; // Removed to avoid hard-coded dependency
// import { useAuthMethod } from "@/shared/auth/components/Auth/useAuthMethod";
const useAuthMethod = () => 'popup' as 'popup' | 'redirect'; // TODO: Implement useAuthMethod

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  expires_at: number;
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (options?: { returnUrl?: string }) => void;
  signOut: () => void;
}

export interface AuthConfig {
  redirectUrlKey: string;
  userStorageKey: string;
}

/**
 * Base authentication hook that provides common authentication functionality
 */
export function useBaseAuth(authContext: AuthContext, config: AuthConfig, homeUrl = '/') {
  const location = useLocation();
  const navigate = useNavigate();
  const authMethod = useAuthMethod();

  /**
   * Get ID token from localStorage for CORS proxy
   */
  const getIdToken = useCallback((): string | undefined => {
    const storedUser = localStorage.getItem(config.userStorageKey);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.access_token;
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }, [config.userStorageKey]);

  /**
   * Sign in function with redirect URL handling
   */
  const signIn = useCallback(
    async (options?: { returnUrl?: string; isUserInitiated?: boolean }) => {
      // Determine the return URL
      const fullPath = location.pathname + location.search;
      const returnUrl = options?.returnUrl || fullPath;

      // Store return URL in localStorage for redirect flow
      if (!options?.isUserInitiated || authMethod === 'redirect') {
        localStorage.setItem(config.redirectUrlKey, returnUrl);
      }

      // Use the auth theme's sign in method
      authContext.signIn({ returnUrl });
    },
    [authContext, location.pathname, location.search, authMethod, config.redirectUrlKey]
  );

  /**
   * Sign out function
   */
  const signOut = useCallback(async () => {
    authContext.signOut();
  }, [authContext]);

  /**
   * Resume navigation after successful sign in
   * Checks for stored redirect URL and navigates to it
   */
  const resumeAfterSignIn = useCallback(
    (defaultRedirect = homeUrl) => {
      const storedRedirectURL = localStorage.getItem(config.redirectUrlKey);

      // Check if we're already at the stored redirect URL
      const currentPath = location.pathname + location.search;
      if (currentPath === storedRedirectURL) {
        // Clear the redirect URL if we're already at the target
        localStorage.removeItem(config.redirectUrlKey);
        return;
      }

      if (storedRedirectURL) {
        // Clean up the stored redirect URL after using it
        localStorage.removeItem(config.redirectUrlKey);
        navigate(storedRedirectURL, { replace: true });
      } else {
        navigate(defaultRedirect, { replace: true });
      }
    },
    [navigate, location.pathname, location.search, config.redirectUrlKey, homeUrl]
  );

  /**
   * Convert auth user to OIDC-like user format for compatibility
   */
  const user = authContext.user
    ? {
        profile: {
          sub: authContext.user.id,
          email: authContext.user.email,
          name: authContext.user.name,
          picture: authContext.user.picture,
          preferred_username: authContext.user.email,
        },
        access_token: authContext.user.access_token,
        expires_at: authContext.user.expires_at / 1000, // Convert to seconds
      }
    : null;

  return {
    user,
    // Authentication actions
    signIn,
    signOut,
    resumeAfterSignIn,
    // Utility functions
    getIdToken,
    // Original auth object for advanced use cases
    auth: {
      isAuthenticated: authContext.isAuthenticated,
      isLoading: authContext.isLoading,
      user,
      error: null,
      signinRedirect: () => authContext.signIn(),
      signoutRedirect: () => authContext.signOut(),
      signinPopup: () => authContext.signIn(), // Always redirect for OAuth
      signoutSilent: () => authContext.signOut(),
      removeUser: () => authContext.signOut(),
      events: {
        addAccessTokenExpiring: () => {
          /* no-op */
        },
        removeAccessTokenExpiring: () => {
          /* no-op */
        },
      },
      settings: {} as Record<string, unknown>,
    },
  };
}
