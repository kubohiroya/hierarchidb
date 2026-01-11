/**
 * @file useAuth.ts
 * @description Main authentication hook for BFF authentication
 */

import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BFFAuthService, type BFFSignInOptions, type BFFUser } from '../services/BFFAuthService.js';
import { PopupDetectionService } from '../services/PopupDetectionService.js';
import type { AuthProviderType } from '../types/AuthProviderType.js';

// Storage keys
const STORAGE_KEYS = {
  REDIRECT_URL: 'bff-auth-redirect-url',
  REFRESH_TOKEN: 'bff-auth-refresh-token',
  AUTH_METHOD: 'bff-auth-method',
} as const;

// Token refresh timing (5 minutes before expiry) - removed as not used in V2

/**
 * BFF Auth Service Hook
 */
export const useBFFAuthService = () => {
  const authService = BFFAuthService.getInstance();
  const [user, setUser] = useState<BFFUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize user from stored token
  useEffect(() => {
    const initUser = async () => {
      setIsLoading(true);
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } finally {
        setIsLoading(false);
      }
    };
    initUser();
  }, [authService]);

  return {
    isAuthenticated: !!user && user.expires_at > Date.now(),
    isLoading,
    user,
    signIn: async (options?: BFFSignInOptions) => {
      setIsLoading(true);
      try {
        const authenticatedUser = await authService.signIn(options || {});
        setUser(authenticatedUser);
      } finally {
        setIsLoading(false);
      }
    },
    signOut: async () => {
      await authService.signOut();
      setUser(null);
    },
    refreshToken: async () => {
      const refreshedUser = await authService.refreshToken();
      if (refreshedUser) {
        setUser(refreshedUser);
      }
      return refreshedUser;
    },
    getIdToken: () => user?.access_token,
    getAccessToken: () => user?.access_token,
    currentProvider: user?.provider || 'google',
  };
};

/**
 * Main Authentication Hook
 */
export function useAuth(homeUrl = '/') {
  const bffAuth = useBFFAuthService();
  const location = useLocation();
  const navigate = useNavigate();
  const popupDetection = PopupDetectionService.getInstance();
  const currentLocationHref = `${location.pathname}${location.searchStr}`;

  // Track refresh timer
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRefreshing] = useState(false);

  /**
   * Enhanced sign in with popup detection and fallback
   */
  const signIn = useCallback(
    async (options?: {
      returnUrl?: string;
      isUserInitiated?: boolean;
      provider?: AuthProviderType;
      forceMethod?: 'popup' | 'redirect';
    }) => {
      // Determine return URL
      const fullPath = currentLocationHref;
      const returnUrl = options?.returnUrl || fullPath;

      // Store return URL for redirect flow
      if (!options?.isUserInitiated || options?.forceMethod === 'redirect') {
        localStorage.setItem(STORAGE_KEYS.REDIRECT_URL, returnUrl);
      }

      // Determine authentication method
      let method: 'popup' | 'redirect' = options?.forceMethod || 'redirect'; // Default to redirect

      if (!options?.forceMethod) {
        // Auto-detect best method
        const capability = popupDetection.getCapability();
        if (capability === 'blocked') {
          method = 'redirect';
        }
      }

      try {
        // Attempt sign in with BFF
        await bffAuth.signIn({
          returnUrl,
          method,
          provider: options?.provider || 'google',
        });

        // If popup succeeded, update capability
        if (method === 'popup') {
          popupDetection.saveCapability('supported');
        }

        // Clear redirect URL if popup succeeded
        if (method === 'popup') {
          localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        }
      } catch (error) {
        // Handle popup blocked error
        if (
          method === 'popup' &&
          error instanceof Error &&
          (error.message.includes('popup') || error.message.includes('blocked'))
        ) {
          console.warn('[BFF Auth V2] Popup blocked, falling back to redirect');
          popupDetection.saveCapability('blocked');

          // Retry with redirect
          await bffAuth.signIn({
            returnUrl,
            method: 'redirect',
            provider: options?.provider || 'google',
          });
        } else {
          throw error;
        }
      }
    },
    [bffAuth, currentLocationHref, popupDetection]
  );

  /**
   * Enhanced sign out
   */
  const signOut = useCallback(async () => {
    // Clear stored data
    localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Perform sign out
    await bffAuth.signOut();

    // Navigate to home
    void navigate({ to: homeUrl, replace: true });
  }, [bffAuth, navigate, homeUrl]);

  /**
   * Resume navigation after successful sign in
   */
  const resumeAfterSignIn = useCallback(
    (defaultRedirect = homeUrl) => {
      const storedRedirectURL = localStorage.getItem(STORAGE_KEYS.REDIRECT_URL);

      // Check if we're already at the stored redirect URL
      if (currentLocationHref === storedRedirectURL) {
        localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        return;
      }

      if (storedRedirectURL) {
        // Navigate to stored URL
        localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        void navigate({ to: storedRedirectURL, replace: true });
      } else {
        // Navigate to default
        void navigate({ to: defaultRedirect, replace: true });
      }
    },
    [navigate, currentLocationHref, homeUrl]
  );

  /**
   * Get ID token for CORS proxy
   */
  const getIdToken = useCallback((): string | undefined => {
    return bffAuth.getIdToken();
  }, [bffAuth]);

  /**
   * Convert BFF user to OIDC-like format for compatibility
   */
  const user = bffAuth.user
    ? {
        profile: {
          sub: bffAuth.user.id,
          email: bffAuth.user.email,
          name: bffAuth.user.name,
          picture: bffAuth.user.picture,
          preferred_username: bffAuth.user.email,
        },
        access_token: bffAuth.user.access_token,
        refresh_token: bffAuth.user.refresh_token,
        expires_at: bffAuth.user.expires_at / 1000, // Convert to seconds
      }
    : null;

  /**
   * Create auth object compatible with useAuthLib interface
   */
  const auth = {
    isAuthenticated: bffAuth.isAuthenticated,
    isLoading: bffAuth.isLoading || isRefreshing,
    user,
    error: null,
    // OIDC-compatible methods
    signinRedirect: () => signIn({ forceMethod: 'redirect' }),
    signoutRedirect: () => signOut(),
    signinPopup: () => signIn({ forceMethod: 'popup' }),
    signinSilent: () => bffAuth.refreshToken(),
    signoutSilent: () => signOut(),
    removeUser: () => signOut(),
    // Event system (extracted)
    events: {
      addAccessTokenExpiring: (_handler: () => void) => {
        // Could implement event emitter if needed
      },
      removeAccessTokenExpiring: (_handler: () => void) => {
        // Could implement event emitter if needed
      },
    },
    settings: {} as Record<string, unknown>,
  };

  return {
    // Core properties
    user,
    isAuthenticated: bffAuth.isAuthenticated,
    isLoading: bffAuth.isLoading || isRefreshing,

    // Authentication actions
    signIn,
    signOut,
    resumeAfterSignIn,

    // Token management
    getIdToken,
    getAccessToken: bffAuth.getAccessToken,
    refreshToken: bffAuth.refreshToken,

    // Provider info
    currentProvider: bffAuth.currentProvider,

    // Original auth object for compatibility
    auth,

    // Refresh atoms
    isRefreshing,
    tokenExpiresAt: bffAuth.user?.expires_at,
  };
}

/**
 * Global token getter for CORS proxy integration
 */
export function getIdToken(): string | undefined {
  // Get token from localStorage for synchronous access
  const token = localStorage.getItem('access_token');
  return token || undefined;
}
