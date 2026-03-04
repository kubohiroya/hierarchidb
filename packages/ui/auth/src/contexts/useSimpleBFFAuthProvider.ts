import React from 'react';
import { maybeEmitBffWarning, readWarningFromResponse } from '~/services/BffWarning';
import { PopupDetectionService } from '~/services/PopupDetectionService';
import type { AuthProviderType } from '~/types/AuthProviderType';
import type { AuthUser } from '~/types/AuthUser';
import {
  useSimpleBFFAuthHmrAccept,
  useSimpleBFFAuthProviderContext,
} from './useSimpleBFFAuthProviderContext';

const DEFAULT_BFF_BASE_URL = 'https://hierarchidb-bff.kubohiroya.workers.dev';

/**
 * Normalize Google profile photo URL for better reliability
 * Applies multiple strategies to improve image loading success
 */
const normalizeGooglePhotoUrl = (photoUrl: string | undefined): string | undefined => {
  if (!photoUrl) return undefined;

  // Check if it's a Google user content URL
  if (photoUrl.includes('googleusercontent.com')) {
    let normalizedUrl = photoUrl;

    // Strategy 1: Use a reasonable size (not too large to avoid 429 errors)
    normalizedUrl = normalizedUrl.replace(/=s\d+(-c)?$/, '=s96');

    // Strategy 2: Remove any additional parameters that might cause issues
    const urlParts = normalizedUrl.split('?');
    if (urlParts.length > 1) {
      normalizedUrl = urlParts[0] ?? normalizedUrl; // Remove query parameters
    }

    // Strategy 3: Ensure we're using the correct size parameter format
    if (!normalizedUrl.includes('=s96')) {
      normalizedUrl += normalizedUrl.includes('=') ? '' : '=s96';
    }

    // Google photo URL normalized for better reliability
    return normalizedUrl;
  }

  return photoUrl;
};

/**
 * Normalize profile photo URL based on provider
 */
const normalizeProfilePhotoUrl = (
  photoUrl: string | undefined,
  provider: AuthProviderType,
): string | undefined => {
  if (!photoUrl) return undefined;

  if (provider === 'google') {
    return normalizeGooglePhotoUrl(photoUrl);
  }

  // GitHub avatars don't need normalization
  if (provider === 'github') {
    return photoUrl;
  }

  return photoUrl;
};

// PKCE helper functions
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const normalizeAuthBase = (rawBase?: string): string => {
  const base = (rawBase ?? '').trim().replace(/\/$/, '');
  if (isAbsoluteUrl(base)) {
    const url = new URL(base);
    const origin = `${url.protocol}//${url.host}`;
    const path = url.pathname.replace(/\/$/, '');
    // If the upstream is configured with /api/auth, call /auth to match BFF routes
    if (path.endsWith('/api/auth')) {
      return `${origin}/auth`;
    }
    if (path.endsWith('/auth')) {
      return `${origin}${path}`;
    }
    return `${origin}/auth`;
  }
  const sanitized = base.startsWith('/') ? base : `/${base}`;
  if (sanitized.endsWith('/api/auth')) {
    return '/auth';
  }
  if (sanitized.endsWith('/auth')) {
    return sanitized;
  }
  return `${sanitized}/auth`;
};

const buildAuthUrl = (authBase: string, path: string): URL => {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (isAbsoluteUrl(authBase)) {
    return new URL(`${authBase}${suffix}`);
  }
  return new URL(`${authBase}${suffix}`, window.location.origin);
};

interface UseSimpleBFFAuthProviderParams {
  homeUrl: string;
}

export function useSimpleBFFAuthProvider({ homeUrl }: UseSimpleBFFAuthProviderParams) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const refreshInProgressRef = React.useRef(false);
  const refreshDisabledRef = React.useRef(false);
  const lastRefreshAttemptRef = React.useRef<number>(0);

  useSimpleBFFAuthHmrAccept();

  // Load user from storage on mount
  React.useEffect(() => {
    const loadUser = () => {
      try {
        const storedToken = localStorage.getItem('access_token');
        const userInfo = localStorage.getItem('userinfo');

        // Check for stuck authentication atoms
        const pkceTimestamp = localStorage.getItem('pkce_timestamp');
        if (pkceTimestamp && !userInfo) {
          const pkceAge = Date.now() - Number.parseInt(pkceTimestamp, 10);
          if (pkceAge > 10 * 60 * 1000) {
            // 10 minutes

            localStorage.removeItem('pkce_code_verifier');
            localStorage.removeItem('pkce_state');
            localStorage.removeItem('pkce_timestamp');
            localStorage.removeItem('auth_provider');
            localStorage.removeItem('auth_callback_processing');
            localStorage.removeItem('auth_processing_code');
            setIsAuthenticating(false);
          }
        }

        if (storedToken && userInfo) {
          const userData = JSON.parse(userInfo);
          // Normalize photo URL based on provider
          if (userData.picture && userData.provider) {
            userData.picture = normalizeProfilePhotoUrl(userData.picture, userData.provider);
          }
          const authUser: AuthUser = {
            id: userData.sub ?? userData.id,
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            provider: (userData.provider ?? 'google') as AuthProviderType,
            access_token: storedToken,
            id_token: localStorage.getItem('id_token') ?? undefined,
            expires_at: Date.now() + 48 * 60 * 60 * 1000, // 48 hours default
          };
          setUser(authUser);
        } else {
          // Ensure isAuthenticating is false if no user
          setIsAuthenticating(false);
        }
      } catch {
        setIsAuthenticating(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  React.useEffect(() => {
    if (user?.access_token) {
      refreshDisabledRef.current = false;
    }
  }, [user?.access_token]);

  const signIn = React.useCallback(
    async (options?: {
      returnUrl?: string;
      method?: 'redirect' | 'popup';
      provider?: AuthProviderType;
    }) => {
      // Check if user is already authenticated
      if (user && localStorage.getItem('access_token')) {
        return;
      }

      // Check if already authenticating
      if (isAuthenticating) {
        return;
      }

      // Check if we just completed authentication (within last 30 seconds)
      const lastAuthTime = localStorage.getItem('last_auth_completion');
      if (lastAuthTime) {
        const timeSinceAuth = Date.now() - Number.parseInt(lastAuthTime, 10);
        if (timeSinceAuth < 30000) {
          // Increased to 30s to handle slow redirects
          return;
        }
      }

      // Clean up any stale PKCE parameters older than 5 minutes
      const pkceTimestamp = localStorage.getItem('pkce_timestamp');
      if (pkceTimestamp) {
        const pkceAge = Date.now() - Number.parseInt(pkceTimestamp, 10);
        if (pkceAge > 5 * 60 * 1000) {
          // 5 minutes
          localStorage.removeItem('pkce_code_verifier');
          localStorage.removeItem('pkce_state');
          localStorage.removeItem('pkce_timestamp');
          localStorage.removeItem('auth_provider');
        }
      }

      // Force cleanup of any authentication remnants if needed
      const forceCleanup = localStorage.getItem('auth_force_cleanup');
      if (forceCleanup) {
        localStorage.removeItem('auth_force_cleanup');
        localStorage.removeItem('pkce_code_verifier');
        localStorage.removeItem('pkce_state');
        localStorage.removeItem('pkce_timestamp');
        localStorage.removeItem('auth_provider');
        localStorage.removeItem('auth_callback_processing');
        localStorage.removeItem('auth_processing_code');
      }

      try {
        // CRITICAL: Store return URL BEFORE setting isAuthenticating
        // This ensures we capture the URL before any atoms changes
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        const returnUrl = options?.returnUrl ?? currentUrl;

        // Don't store auth callback URLs as return URLs
        if (!returnUrl.includes('/auth/callback')) {
          // Use localStorage instead of localStorage to persist across redirects
          localStorage.setItem('auth_redirect_url', returnUrl);
        } else {
          localStorage.setItem('auth_redirect_url', homeUrl);
        }

        // NOW set authenticating atoms
        setIsAuthenticating(true);

        // Don't store history atoms - history manipulation causes more problems than it solves
        // localStorage.setItem('auth_history_length', window.history.length.toString());
        // localStorage.setItem('auth_start_time', Date.now().toString());

        // Get provider (default to google)
        const provider = options?.provider ?? 'google';

        // Generate PKCE parameters
        const codeVerifier = generateRandomString(64);
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store code verifier for later use - with timestamp to track freshness
        localStorage.setItem('pkce_code_verifier', codeVerifier);
        localStorage.setItem('pkce_timestamp', Date.now().toString());
        localStorage.setItem('auth_provider', provider);

        // Get configuration
        const bffBaseUrl = import.meta.env.VITE_BFF_BASE_URL ?? DEFAULT_BFF_BASE_URL;
        const authBase = normalizeAuthBase(bffBaseUrl);

        // Build authorization URL
        const authUrl = buildAuthUrl(authBase, `/authorize/${provider}`);

        // Get the appropriate client ID based on provider
        let clientId: string | undefined;
        if (provider === 'github') {
          clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
        } else {
          clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
        }

        if (!clientId) {
          const errorMsg = `${provider.charAt(0).toUpperCase() + provider.slice(1)} Client ID is not configured. Please add VITE_${provider.toUpperCase()}_CLIENT_ID to your .env file.`;
          // Show alert for configuration error
          alert(errorMsg);
          setIsAuthenticating(false);
          return;
        }

        authUrl.searchParams.set('client_id', clientId);
        // Don't send redirect_uri - let BFF use its configured value
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid profile email');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        // Add return origin for BFF to know where to redirect after OAuth
        // This allows using the same OAuth App for both dev and prod
        authUrl.searchParams.set('return_origin', window.location.origin);

        // Check auth method preference - Default to redirect due to COOP issues
        const authMethod =
          options?.method ?? localStorage.getItem('eria-Auth-method') ?? 'redirect';

        // Test popup capability using the service
        const popupService = PopupDetectionService.getInstance();
        const popupCapability = popupService.getCapability();

        const shouldUsePopup = authMethod === 'popup' && popupCapability === 'supported';

        if (authMethod === 'popup' && popupCapability !== 'supported') {
          // Falling back to redirect authentication
        }

        if (shouldUsePopup) {
          // Open in popup window
          const width = 500;
          const height = 600;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;

          const popup = window.open(
            authUrl.toString(),
            `${provider}-auth`,
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
          );

          if (!popup) {
            alert('Popup was blocked. Please allow popups for this site.');
            setIsAuthenticating(false);
            return;
          }

          // Listen for messages from popup
          const handlePopupMessage = (event: MessageEvent) => {
            // Only accept messages from same origin (since popup gets redirected back to src domain)
            if (event.origin === window.location.origin && event.data && event.data.type) {
              if (event.data.type === 'AUTH_SUCCESS') {
                cleanupPopupListeners();
                setIsAuthenticating(false);
                if (!popup.closed) {
                  popup.close();
                }
              } else if (event.data.type === 'AUTH_ERROR') {
                cleanupPopupListeners();
                setIsAuthenticating(false);
                alert(event.data.error ?? 'Authentication failed');
                if (!popup.closed) {
                  popup.close();
                }
              }
            }
          };

          // Listen for localStorage events as backup communication method
          const handleStorageEvent = (event: StorageEvent) => {
            if (
              event.key === 'auth_popup_success' ? true : event.key === 'auth_popup_success_final'
            ) {
              cleanupPopupListeners();
              setIsAuthenticating(false);
              if (!popup.closed) {
                popup.close();
              }
            } else if (event.key === 'auth_popup_error') {
              cleanupPopupListeners();
              setIsAuthenticating(false);
              alert(event.newValue ?? 'Authentication failed');
              if (!popup.closed) {
                popup.close();
              }
            }
          };

          // Cleanup function
          const cleanupPopupListeners = () => {
            clearInterval(checkPopup);
            clearInterval(coopFallbackCheck);
            window.removeEventListener('message', handlePopupMessage);
            window.removeEventListener('storage', handleStorageEvent);
            // Clean up direct functions
            const windowWithAuth = window as Window & {
              handleAuthSuccess?: () => void;
              handleAuthError?: (error: string) => void;
              authCheckTimestamp?: number;
            };
            delete windowWithAuth.handleAuthSuccess;
            delete windowWithAuth.handleAuthError;
            delete windowWithAuth.authCheckTimestamp;
          };

          // Expose direct function for popup to call (COOP-safe)
          const windowWithAuth = window as Window & {
            handleAuthSuccess?: () => void;
            handleAuthError?: (error: string) => void;
            authCheckTimestamp?: number;
          };
          windowWithAuth.handleAuthSuccess = () => {
            cleanupPopupListeners();
            setIsAuthenticating(false);
            if (!popup.closed) {
              popup.close();
            }
          };

          windowWithAuth.handleAuthError = (_error: string) => {
            cleanupPopupListeners();
            setIsAuthenticating(false);

            if (!popup.closed) {
              popup.close();
            }
          };

          // Additional COOP-safe mechanism: Use a shared timestamp to detect completion
          let lastAuthCheck = Date.now();
          windowWithAuth.authCheckTimestamp = lastAuthCheck;

          const coopFallbackCheck = setInterval(() => {
            const currentTimestamp = windowWithAuth.authCheckTimestamp;
            if (currentTimestamp && currentTimestamp !== lastAuthCheck) {
              const token = localStorage.getItem('access_token');
              if (token) {
                cleanupPopupListeners();
                setIsAuthenticating(false);
                clearInterval(coopFallbackCheck);
              }
              lastAuthCheck = currentTimestamp;
            }
          }, 1000);

          window.addEventListener('message', handlePopupMessage);
          window.addEventListener('storage', handleStorageEvent);

          // Monitor popup for completion (COOP-safe fallback mechanism)
          let popupCheckCount = 0;
          let consecutiveErrors = 0;

          const checkPopup = setInterval(() => {
            popupCheckCount++;

            try {
              // Try to access popup.closed - this will throw in COOP environments
              const isClosed = popup.closed;
              consecutiveErrors = 0; // Reset error count on success

              if (popupCheckCount % 10 === 0) {
                // Log every 5 seconds
              }

              if (isClosed) {
                cleanupPopupListeners();

                // Check if auth was successful by looking for stored tokens
                setTimeout(() => {
                  const token = localStorage.getItem('access_token');

                  if (!token) {
                    setIsAuthenticating(false);
                  } else {
                    setIsAuthenticating(false);
                  }
                }, 200);
              }
            } catch {
              consecutiveErrors++;

              // COOP error - we can't check popup.closed, so rely on other methods
              if (popupCheckCount % 20 === 0) {
                // Log every 10 seconds
              }

              // In COOP environment, we rely heavily on storage events and postMessage
              // Check if we should assume popup is done based on storage changes
              const token = localStorage.getItem('access_token');
              if (token && consecutiveErrors > 5) {
                cleanupPopupListeners();
                setIsAuthenticating(false);
              }
            }
          }, 500);

          // Cleanup timeout to prevent memory leaks
          setTimeout(() => {
            cleanupPopupListeners();
            if (!popup.closed) {
              popup.close();
            }
            setIsAuthenticating(false);
          }, 300000); // 5 minutes timeout
        } else {
          // For GitHub, first check if the endpoint exists
          if (provider === 'github') {
            const checkUrl = buildAuthUrl(authBase, `/authorize/${provider}`);
            const response = await fetch(checkUrl.toString(), {
              method: 'HEAD',
            });
            if (response.status === 404) {
              setIsAuthenticating(false);
              return;
            }
          }

          // Redirect to BFF authorization endpoint using replace to avoid history entry

          // Small delay to ensure atoms is saved
          setTimeout(() => {
            window.location.replace(authUrl.toString());
          }, 100);
        }
      } catch {
        setIsAuthenticating(false);

        // Mark for force cleanup on next attempt
        localStorage.setItem('auth_force_cleanup', 'true');
      }
    },
    [homeUrl, isAuthenticating, user],
  );

  const signOut = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');

      // Clear local storage
      localStorage.removeItem('access_token');
      localStorage.removeItem('id_token');
      localStorage.removeItem('userinfo');

      // Clear auth history tracking
      localStorage.removeItem('auth_history_length');
      localStorage.removeItem('auth_start_time');
      localStorage.removeItem('auth_redirect_url');
      localStorage.removeItem('last_auth_completion');
      localStorage.removeItem('auth_callback_processed');
      localStorage.removeItem('auth_callback_processing');
      localStorage.removeItem('pkce_code_verifier');
      localStorage.removeItem('pkce_state');
      localStorage.removeItem('pkce_timestamp');
      localStorage.removeItem('auth_provider');
      localStorage.removeItem('auth_processing_code');
      localStorage.removeItem('auth_force_cleanup');

      // Reset auth atoms - CRITICAL: Must reset isAuthenticating
      setUser(null);
      setIsAuthenticating(false);

      // Optional: Call BFF logout endpoint
      const authBase = normalizeAuthBase(import.meta.env.VITE_BFF_BASE_URL ?? DEFAULT_BFF_BASE_URL);

      if (token) {
        await fetch(buildAuthUrl(authBase, '/logout').toString(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => readWarningFromResponse(response))
          .catch(() => {
            // Ignore logout errors
          });
      }

      // Redirect to home using replace to avoid history entry
      window.location.replace(homeUrl);
    } catch {
      // Still clear local atoms - CRITICAL: Must reset isAuthenticating
      setUser(null);
      setIsAuthenticating(false);

      // Force cleanup on next auth attempt
      localStorage.setItem('auth_force_cleanup', 'true');

      window.location.replace(homeUrl);
    }
  }, [homeUrl]);

  const getAccessToken = React.useCallback(() => {
    return localStorage.getItem('access_token') ?? null;
  }, []);

  const getIdToken = React.useCallback(() => {
    return localStorage.getItem('id_token') ?? null;
  }, []);

  // Token refresh function
  const refreshAccessToken = React.useCallback(async (): Promise<boolean> => {
    // Prevent multiple simultaneous refresh attempts
    if (refreshInProgressRef.current) {
      return false;
    }
    if (refreshDisabledRef.current) {
      return false;
    }

    // Prevent rapid refresh attempts (wait at least 30 seconds between attempts)
    const now = Date.now();
    if (now - lastRefreshAttemptRef.current < 30000) {
      return false;
    }

    const currentToken = getAccessToken();
    if (!currentToken) {
      return false;
    }

    refreshInProgressRef.current = true;
    lastRefreshAttemptRef.current = now;

    try {
      const authBase = normalizeAuthBase(import.meta.env.VITE_BFF_BASE_URL ?? DEFAULT_BFF_BASE_URL);

      // Call BFF refresh endpoint
      const response = await fetch(buildAuthUrl(authBase, '/refresh').toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        credentials: 'include', // Include cookies if BFF uses them
      });

      const data = await response.json().catch(() => null);
      const warning = maybeEmitBffWarning((data as { warning?: unknown })?.warning);
      if (warning?.operation === 'refresh') {
        refreshDisabledRef.current = true;
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Clear auth storage and trigger re-authentication
          localStorage.removeItem('access_token');
          localStorage.removeItem('id_token');
          localStorage.removeItem('userinfo');
          localStorage.removeItem('auth_provider');
          localStorage.removeItem('auth_callback_processing');
          localStorage.removeItem('auth_processing_code');
          localStorage.removeItem('auth_force_cleanup');
          localStorage.removeItem('pkce_code_verifier');
          localStorage.removeItem('pkce_state');
          localStorage.removeItem('pkce_timestamp');
          localStorage.removeItem('token_expires_at');
          localStorage.removeItem('token_expires_in');
          localStorage.removeItem('last_auth_completion');
          setUser(null);

          // Don't automatically trigger sign in - let the user decide

          return false;
        }
        return false;
      }

      if (data && 'access_token' in data && data.access_token) {
        // Update tokens in local storage
        localStorage.setItem('access_token', data.access_token);
        if (data.id_token) {
          localStorage.setItem('id_token', data.id_token);
        }

        // Update user info if provided
        if (data.userinfo) {
          localStorage.setItem('userinfo', JSON.stringify(data.userinfo));

          // Update user atoms
          const authUser: AuthUser = {
            id: data.userinfo.sub ?? data.userinfo.id,
            email: data.userinfo.email,
            name: data.userinfo.name,
            picture: normalizeProfilePhotoUrl(data.userinfo.picture, data.provider ?? 'google'),
            provider: (data.provider ?? 'google') as AuthProviderType,
            access_token: data.access_token,
            id_token: data.id_token ?? data.access_token,
            expires_at: data.expires_at ?? Date.now() + 3600000, // Default 1 hour
          };

          setUser(authUser);
        }

        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [getAccessToken]);

  // Update user from local storage (called by callback page)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const userInfo = localStorage.getItem('userinfo');
      const accessToken = localStorage.getItem('access_token');

      // Skip if user is already authenticated with same access token
      if (user && user.access_token === accessToken) {
        return;
      }

      if (userInfo && accessToken) {
        const userData = JSON.parse(userInfo);
        const authUser: AuthUser = {
          id: userData.sub ?? userData.id,
          email: userData.email,
          name: userData.name,
          picture: normalizeProfilePhotoUrl(userData.picture, userData.provider ?? 'google'),
          provider: (userData.provider ?? 'google') as AuthProviderType,
          access_token: accessToken,
          id_token: localStorage.getItem('id_token') ?? undefined,
          expires_at: Date.now() + 48 * 60 * 60 * 1000, // 48 hours default
        };

        setUser(authUser);

        // Store token expiry time for monitoring
        const expiresIn = localStorage.getItem('token_expires_in');
        if (expiresIn) {
          const expiresAt = Date.now() + Number.parseInt(expiresIn, 10) * 1000;
          localStorage.setItem('token_expires_at', expiresAt.toString());
        }

        // Mark authentication as completed - use localStorage to persist
        localStorage.setItem('last_auth_completion', Date.now().toString());
        setIsAuthenticating(false);

        // Clean up PKCE data after successful auth
        localStorage.removeItem('pkce_code_verifier');
        localStorage.removeItem('pkce_state');
        localStorage.removeItem('pkce_timestamp');
        localStorage.removeItem('auth_callback_processing');
        localStorage.removeItem('auth_processing_code');
      }
    };

    // Enhanced monitoring for auth completion
    let checkInterval: ReturnType<typeof setInterval>;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const startAuthMonitoring = () => {
      let monitoringCount = 0;

      // Check for auth completion more frequently and for longer duration
      checkInterval = setInterval(() => {
        monitoringCount++;
        const userInfo = localStorage.getItem('userinfo');
        const accessToken = localStorage.getItem('access_token');

        if (monitoringCount % 100 === 0) {
          // Log every 5 seconds
        }

        if (userInfo && accessToken) {
          handleStorageChange();
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
        }
      }, 50); // Check every 50ms for faster response

      // Clear interval after 60 seconds to prevent memory leak
      timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
      }, 60000);
    };

    // Always check for existing auth data on mount
    const userInfo = localStorage.getItem('userinfo');
    const accessToken = localStorage.getItem('access_token');

    if (userInfo && accessToken && !user) {
      handleStorageChange();
    } else if (isAuthenticating) {
      startAuthMonitoring();
    }

    // Listen for storage changes (this works across tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [isAuthenticating, user]); // Add dependencies

  // Token expiration monitoring
  React.useEffect(() => {
    const currentUser = user;
    if (currentUser == null) return;
    if (currentUser.expires_at == null) return;

    const checkTokenExpiry = () => {
      const now = Date.now();
      const expiresAt = currentUser.expires_at;
      const expiresIn = Math.floor((expiresAt - now) / 1000); // Convert to seconds

      if (expiresIn < 0) {
        refreshAccessToken();
      } else if (expiresIn < 300) {
        // 5 minutes before expiry

        refreshAccessToken();
      }
    };

    // Initial check
    checkTokenExpiry();

    // Set up interval to check every minute
    const intervalId = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(intervalId);
  }, [user, refreshAccessToken]);

  return useSimpleBFFAuthProviderContext({
    user,
    isLoading,
    isAuthenticating,
    signIn,
    signOut,
    getAccessToken,
    getIdToken,
    refreshAccessToken,
  });
}
