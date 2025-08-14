import { useCallback, useEffect, useState } from 'react';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import { useLocation, useNavigate } from 'react-router';
import { User } from 'oidc-client-ts';
// import { APP_PREFIX } from "@/config/appDescription"; // Removed to avoid hard-coded dependency
import { useAuthMethod } from './useAuthMethod';
// import { isGitHubPages } from "@/config/routing";
const isGitHubPages = () => false; // TODO: Implement isGitHubPages

const authority = import.meta.env.VITE_OIDC_AUTHORITY;
const client_id = import.meta.env.VITE_OIDC_CLIENT_ID;

export function getAccessTokenKey(): string {
  return `oidc.user:${authority}:${client_id}`;
}

function getLocallyStoredUser(): User | null {
  const oidcStorage = localStorage.getItem(getAccessTokenKey());
  if (!oidcStorage) {
    return null;
  }
  return User.fromStorageString(oidcStorage);
}

export function getIdToken(): string | undefined {
  const user = getLocallyStoredUser();
  return user?.id_token;
}

// Use localStorage key for redirect URL to persist across browser sessions
const REDIRECT_URL_KEY = 'oidc.redirect';

/**
 * Unified authentication hook that combines functionality from useSignIn and useAuthActions
 * Handles both redirect and popup authentication methods
 * Uses localStorage for persistence across redirects and browser sessions
 * @param homeUrl - The URL to redirect to after authentication (default: "/")
 */
export function useAuthLib(homeUrl = '/') {
  const auth = useOidcAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { authMethod } = useAuthMethod();

  const [hasTriedSignin, setHasTriedSignin] = useState(false);

  // Handle automatic token renewal
  useEffect(() => {
    const handleTokenExpiring = () => {
      // Save current location before silent renewal
      const fullPath = location.pathname + location.search;
      localStorage.setItem(REDIRECT_URL_KEY, fullPath);
      auth.signinSilent();
    };

    auth.events.addAccessTokenExpiring(handleTokenExpiring);
    return () => auth.events.removeAccessTokenExpiring(handleTokenExpiring);
  }, [auth, location.pathname, location.search]);

  /**
   * Sign in function that handles both redirect and popup methods
   * @param options - Optional configuration for sign in
   * @param options.returnUrl - URL to redirect to after successful sign in
   * @param options.isUserInitiated - Whether this sign in was initiated by user action (e.g., clicking sign in button)
   */
  const signIn = useCallback(
    async (options?: { returnUrl?: string; isUserInitiated?: boolean }) => {
      if (auth.isLoading || hasTriedSignin) {
        return;
      }

      setHasTriedSignin(true);

      // Determine the return URL
      const fullPath = location.pathname + location.search;
      const returnUrl = options?.returnUrl || fullPath;

      // Store return URL in localStorage for redirect flow
      // For user-initiated sign in (from top-right button), we might not want to store a redirect
      if (!options?.isUserInitiated || authMethod === 'redirect') {
        localStorage.setItem(REDIRECT_URL_KEY, returnUrl);
      }

      // Handle GitHub Pages specific requirements
      const extraParams = isGitHubPages()
        ? {
            state: btoa(
              JSON.stringify({
                returnPath: window.location.hash.slice(1) || '/',
              })
            ),
          }
        : undefined;

      try {
        if (authMethod === 'popup') {
          const user = await auth.signinPopup(extraParams);
          // For popup, we don't need to navigate after sign in
          return user;
        } else {
          await auth.signinRedirect(extraParams);
          // This line won't be reached as the browser redirects
          return;
        }
      } catch (error) {
        // For popup, fall back to redirect if popup is blocked
        if (authMethod === 'popup' && error instanceof Error && error.message.includes('popup')) {
          await auth.signinRedirect(extraParams);
          return;
        } else {
          throw error;
        }
      }
    },
    [auth, authMethod, location.pathname, location.search, hasTriedSignin]
  );

  /**
   * Sign out function that handles both redirect and popup methods
   */
  const signOut = useCallback(async () => {
    try {
      if (authMethod === 'popup') {
        // For popup mode, use silent sign out
        await auth.signoutSilent();
      } else {
        await auth.signoutRedirect();
      }
    } catch (error) {
      // Fallback: remove user from local storage
      auth.removeUser();
      throw error;
    }
  }, [auth, authMethod]);

  /**
   * Resume navigation after successful sign in
   * Checks for stored redirect URL and navigates to it
   */
  const resumeAfterSignIn = useCallback(
    (defaultRedirect = homeUrl) => {
      const storedRedirectURL = localStorage.getItem(REDIRECT_URL_KEY);

      // Check if we're already at the stored redirect URL
      const currentPath = location.pathname + location.search;
      if (currentPath === storedRedirectURL) {
        // Clear the redirect URL if we're already at the target
        localStorage.removeItem(REDIRECT_URL_KEY);
        return;
      }

      if (storedRedirectURL) {
        // Clean up the stored redirect URL after using it
        localStorage.removeItem(REDIRECT_URL_KEY);
        navigate(storedRedirectURL, { replace: true });
      } else {
        navigate(defaultRedirect, { replace: true });
      }
    },
    [navigate, location.pathname, location.search, homeUrl]
  );

  return {
    user: auth.user,
    // Authentication actions
    signIn,
    signOut,
    resumeAfterSignIn,
    // Utility functions
    getIdToken,
    // Original auth object for advanced use cases
    auth,
  };
}
