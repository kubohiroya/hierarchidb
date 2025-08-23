/**
 * @file useAuthWithFallback.ts
 * @description Enhanced auth hook with popup detection and fallback to redirect
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthLib } from './useAuthLib';
import { PopupDetectionService } from '../../services/PopupDetectionService';

// Temporary implementations for missing dependencies
const useAuthMethod = () => ({
  authMethod: 'popup' as 'popup' | 'redirect',
  setAuthMethod: (_method: 'popup' | 'redirect') => {},
});

const devError = (msg: string, ...args: any[]) => console.error(msg, ...args);
const devLog = (msg: string, ...args: any[]) => console.log(msg, ...args);
const devWarn = (msg: string, ...args: any[]) => console.warn(msg, ...args);

interface UseAuthWithFallbackReturn {
  signInWithFallback: (options?: {
    returnUrl?: string;
    isUserInitiated?: boolean;
  }) => Promise<void>;
  isCheckingPopupSupport: boolean;
  popupSupported: boolean | null;
  forceRedirectAuth: () => Promise<void>;
}

export function useAuthWithFallback(): UseAuthWithFallbackReturn {
  const { signIn } = useAuthLib();
  const { authMethod, setAuthMethod } = useAuthMethod();
  const [isCheckingPopupSupport, setIsCheckingPopupSupport] = useState(false);
  const [popupSupported, setPopupSupported] = useState<boolean | null>(null);

  const popupDetection = PopupDetectionService.getInstance();

  // Check popup support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const capability = popupDetection.getCapability();

      if (capability === 'unknown') {
        setIsCheckingPopupSupport(true);
        const result = await popupDetection.testPopupCapability();
        setIsCheckingPopupSupport(false);
        setPopupSupported(result === 'supported');

        devLog(`Popup capability test result: ${result}`);
      } else {
        setPopupSupported(capability === 'supported');
      }
    };

    checkSupport();
  }, [popupDetection]);

  /**
   * Sign in with automatic fallback to redirect if popup is blocked
   */
  const signInWithFallback = useCallback(
    async (options?: { returnUrl?: string; isUserInitiated?: boolean }) => {
      try {
        // First, check if we know popups are blocked
        if (popupSupported === false || popupDetection.isPotentiallyBlocked()) {
          devLog('Popups are blocked, using redirect method');

          // Temporarily set auth method to redirect
          const originalMethod = authMethod;
          setAuthMethod('redirect');

          try {
            await signIn(options);
          } finally {
            // Restore original method (though page will redirect)
            setAuthMethod(originalMethod);
          }

          return;
        }

        // Try popup method first
        devLog('Attempting popup authentication');

        try {
          await signIn(options);

          // If we get here, popup worked
          if (popupSupported === null) {
            popupDetection.saveCapability('supported');
            setPopupSupported(true);
          }
        } catch (error) {
          // Check if error is due to popup being blocked
          if (
            error instanceof Error &&
            (error.message.includes('popup') || error.message.includes('blocked'))
          ) {
            devWarn('Popup was blocked, falling back to redirect');

            // Mark popups as blocked
            popupDetection.saveCapability('blocked');
            setPopupSupported(false);

            // Fall back to redirect
            const originalMethod = authMethod;
            setAuthMethod('redirect');

            try {
              await signIn(options);
            } finally {
              setAuthMethod(originalMethod);
            }
          } else {
            // Other error, re-throw
            throw error;
          }
        }
      } catch (error) {
        devError('Authentication failed:', error);
        throw error;
      }
    },
    [authMethod, setAuthMethod, signIn, popupSupported, popupDetection]
  );

  /**
   * Force redirect authentication (for environments where popups don't work)
   */
  const forceRedirectAuth = useCallback(async () => {
    devLog('Forcing redirect authentication');

    // Mark popups as blocked
    popupDetection.saveCapability('blocked');
    setPopupSupported(false);

    // Use redirect method
    const originalMethod = authMethod;
    setAuthMethod('redirect');

    try {
      await signIn();
    } finally {
      setAuthMethod(originalMethod);
    }
  }, [authMethod, setAuthMethod, signIn, popupDetection]);

  return {
    signInWithFallback,
    isCheckingPopupSupport,
    popupSupported,
    forceRedirectAuth,
  };
}
