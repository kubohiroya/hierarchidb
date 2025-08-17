/**
 * @file useEnhancedBFFAuth.ts
 * @description Enhanced BFF authentication hook with enterprise features
 * Combines BFF security with useAuthLib functionality
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthProviderType } from '../types/AuthProviderType';
import { PopupDetectionService } from '../services/PopupDetectionService';

// BFF Auth Service interface
interface BFFAuthService {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: BFFUser | null;
  signIn: (options?: BFFSignInOptions) => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<BFFUser | null>;
  getIdToken: () => string | undefined;
  getAccessToken: () => string | undefined;
  currentProvider: AuthProviderType;
}

interface BFFUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  provider?: AuthProviderType;
}

interface BFFSignInOptions {
  returnUrl?: string;
  method?: 'popup' | 'redirect';
  provider?: AuthProviderType;
}

// Storage keys
const STORAGE_KEYS = {
  REDIRECT_URL: 'bff-auth-redirect-url',
  USER_DATA: 'bff-auth-user',
  REFRESH_TOKEN: 'bff-auth-refresh-token',
  AUTH_METHOD: 'bff-auth-method',
} as const;

// Token refresh timing (5 minutes before expiry)
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000;

/**
 * Mock BFF Auth Service - Replace with actual implementation
 */
const useBFFAuthService = (): BFFAuthService => {
  const [user, setUser] = useState<BFFUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);

  return {
    isAuthenticated: !!user && user.expires_at > Date.now(),
    isLoading,
    user,
    signIn: async (options) => {
      setIsLoading(true);
      try {
        // Actual BFF call would go here
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options),
        });
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      } finally {
        setIsLoading(false);
      }
    },
    signOut: async () => {
      await fetch('/api/auth/signout', { method: 'POST' });
      setUser(null);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    },
    refreshToken: async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
        return data.user;
      }
      return null;
    },
    getIdToken: () => user?.access_token,
    getAccessToken: () => user?.access_token,
    currentProvider: user?.provider || 'google',
  };
};

/**
 * Enhanced BFF Authentication Hook
 * Provides enterprise features on top of BFF authentication
 */
export function useBFFAuth(homeUrl = '/') {
  const bffAuth = useBFFAuthService();
  const location = useLocation();
  const navigate = useNavigate();
  const popupDetection = PopupDetectionService.getInstance();

  // Track refresh timer
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Calculate time until token expiry
   */
  const getTimeUntilExpiry = useCallback((): number => {
    if (!bffAuth.user?.expires_at) return 0;
    return bffAuth.user.expires_at - Date.now();
  }, [bffAuth.user]);

  /**
   * Check if token needs refresh
   */
  const needsRefresh = useCallback((): boolean => {
    const timeUntilExpiry = getTimeUntilExpiry();
    return timeUntilExpiry > 0 && timeUntilExpiry <= TOKEN_REFRESH_BUFFER;
  }, [getTimeUntilExpiry]);

  /**
   * Perform token refresh
   */
  const performTokenRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      console.log('[BFF Auth] Refreshing token...');
      const refreshedUser = await bffAuth.refreshToken();

      if (refreshedUser) {
        console.log('[BFF Auth] Token refreshed successfully');

        // Schedule next refresh
        const nextRefreshIn = refreshedUser.expires_at - Date.now() - TOKEN_REFRESH_BUFFER;
        if (nextRefreshIn > 0) {
          refreshTimerRef.current = setTimeout(performTokenRefresh, nextRefreshIn);
        }
      } else {
        console.warn('[BFF Auth] Token refresh failed, user needs to re-authenticate');

        // Store current location for redirect after re-auth
        const currentPath = location.pathname + location.search;
        localStorage.setItem(STORAGE_KEYS.REDIRECT_URL, currentPath);

        // Clear user data
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);

        // Optionally prompt user
        if (confirm('Your session has expired. Would you like to sign in again?')) {
          await signIn({ returnUrl: currentPath });
        }
      }
    } catch (error) {
      console.error('[BFF Auth] Token refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [bffAuth, isRefreshing, location.pathname, location.search]);

  /**
   * Set up automatic token refresh
   */
  useEffect(() => {
    if (!bffAuth.user) {
      // Clear any existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    // Check if we need immediate refresh
    if (needsRefresh()) {
      performTokenRefresh();
    } else {
      // Schedule future refresh
      const timeUntilRefresh = getTimeUntilExpiry() - TOKEN_REFRESH_BUFFER;
      if (timeUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(performTokenRefresh, timeUntilRefresh);
      }
    }

    // Cleanup
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [bffAuth.user, needsRefresh, performTokenRefresh, getTimeUntilExpiry]);

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
      const fullPath = location.pathname + location.search;
      const returnUrl = options?.returnUrl || fullPath;

      // Store return URL for redirect flow
      if (!options?.isUserInitiated || options?.forceMethod === 'redirect') {
        localStorage.setItem(STORAGE_KEYS.REDIRECT_URL, returnUrl);
      }

      // Determine authentication method
      let method: 'popup' | 'redirect' = options?.forceMethod || 'popup';

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
          provider: options?.provider,
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
          console.warn('[BFF Auth] Popup blocked, falling back to redirect');
          popupDetection.saveCapability('blocked');

          // Retry with redirect
          await bffAuth.signIn({
            returnUrl,
            method: 'redirect',
            provider: options?.provider,
          });
        } else {
          throw error;
        }
      }
    },
    [bffAuth, location.pathname, location.search, popupDetection]
  );

  /**
   * Enhanced sign out
   */
  const signOut = useCallback(async () => {
    // Clear stored data
    localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Perform sign out
    await bffAuth.signOut();

    // Navigate to home
    navigate(homeUrl, { replace: true });
  }, [bffAuth, navigate, homeUrl]);

  /**
   * Resume navigation after successful sign in
   */
  const resumeAfterSignIn = useCallback(
    (defaultRedirect = homeUrl) => {
      const storedRedirectURL = localStorage.getItem(STORAGE_KEYS.REDIRECT_URL);

      // Check if we're already at the stored redirect URL
      const currentPath = location.pathname + location.search;
      if (currentPath === storedRedirectURL) {
        localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        return;
      }

      if (storedRedirectURL) {
        // Navigate to stored URL
        localStorage.removeItem(STORAGE_KEYS.REDIRECT_URL);
        navigate(storedRedirectURL, { replace: true });
      } else {
        // Navigate to default
        navigate(defaultRedirect, { replace: true });
      }
    },
    [navigate, location.pathname, location.search, homeUrl]
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
    signinSilent: () => performTokenRefresh(),
    signoutSilent: () => signOut(),
    removeUser: () => signOut(),
    // Event system (simplified)
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
    refreshToken: performTokenRefresh,

    // Provider info
    currentProvider: bffAuth.currentProvider,

    // Original auth object for compatibility
    auth,

    // Refresh state
    isRefreshing,
    tokenExpiresAt: bffAuth.user?.expires_at,
  };
}

/**
 * Global token getter for CORS proxy integration
 */
export function getIdToken(): string | undefined {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_DATA);
  if (stored) {
    try {
      const user = JSON.parse(stored) as BFFUser;
      return user.access_token;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
