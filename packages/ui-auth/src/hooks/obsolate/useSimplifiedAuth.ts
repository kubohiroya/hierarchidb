/**
 * @file useSimplifiedAuth.ts
 * @description Simplified auth hook with popup preference and redirect fallback
 * No IndexedDB persistence needed
 */

import { useCallback, useEffect } from 'react';
import { PopupDetectionService } from '../../services/PopupDetectionService';

// Temporary implementations for missing dependencies
const useOidcAuth = () => ({
  user: null,
  isLoading: false,
  signinSilent: () => Promise.resolve(),
  signinRedirect: () => {},
  signinPopup: () => Promise.resolve(null),
  signoutSilent: () => Promise.resolve(),
  signoutRedirect: () => Promise.resolve(),
  removeUser: () => {},
  events: {
    addAccessTokenExpiring: (_handler: () => void) => {},
    removeAccessTokenExpiring: (_handler: () => void) => {},
  },
});

const useNavigate = () => (_path: string) => {};

const devLog = (msg: string, ...args: any[]) => console.log(msg, ...args);
const devWarn = (msg: string, ...args: any[]) => console.warn(msg, ...args);

export function useSimplifiedAuth() {
  const auth = useOidcAuth();
  // const location = useLocation(); // RemovedProperties: unused variable
  const navigate = useNavigate();
  const popupDetection = PopupDetectionService.getInstance();

  // Handle token expiring with silent refresh
  useEffect(() => {
    const handleTokenExpiring = async () => {
      devLog('Token expiring, attempting silent refresh');

      try {
        await auth.signinSilent();
        devLog('Silent refresh successful');
      } catch (error) {
        devWarn('Silent refresh failed, user needs to re-authenticate', error);

        // Silent refresh failed - need to re-authenticate
        // Since we can't maintain theme through redirect, we accept the loss
        if (
          confirm(
            'Your session has expired. You will need to sign in again. Any unsaved work will be lost.'
          )
        ) {
          // Clear any temporary state
          sessionStorage.clear();

          // Redirect to login
          await auth.signinRedirect();
        }
      }
    };

    auth.events.addAccessTokenExpiring(handleTokenExpiring);
    return () => auth.events.removeAccessTokenExpiring(handleTokenExpiring);
  }, [auth]);

  /**
   * Smart sign in that prefers popup but falls back to redirect
   */
  const signIn = useCallback(() => {
    const capability = popupDetection.getCapability();

    // If we already know popups are blocked, go straight to redirect
    if (capability === 'blocked') {
      devLog('Known popup blocker, using redirect');
      auth.signinRedirect();
      return;
    }

    // Try popup first
    try {
      devLog('Attempting popup authentication');
      auth.signinPopup().then((_user) => {
        // Success - mark popups as supported
        popupDetection.updateCapability('supported');
        devLog('Popup authentication successful');
      });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('popup') || error.message.includes('blocked'))
      ) {
        devWarn('Popup blocked, falling back to redirect');
        popupDetection.updateCapability('blocked');

        // Show warning about theme loss
        alert(
          'Popup authentication was blocked. You will be redirected to sign in. Any unsaved work will be lost.'
        );

        // Fall back to redirect
        auth.signinRedirect();
      } else {
        // Other error, re-throw
        throw error;
      }
    }
  }, [auth, popupDetection]);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    const capability = popupDetection.getCapability();

    if (capability === 'supported') {
      // Try silent signout for popup-capable browsers
      try {
        await auth.signoutSilent();
        auth.removeUser();
        navigate('/');
        return;
      } catch (error) {
        devWarn('Silent signout failed, using redirect', error);
      }
    }

    // Default to redirect signout
    await auth.signoutRedirect();
  }, [auth, navigate, popupDetection]);

  return {
    user: auth.user,
    isAuthenticated: !!auth.user,
    isLoading: auth.isLoading,
    signIn,
    signOut,
    // Expose original auth for advanced use cases
    auth,
  };
}
