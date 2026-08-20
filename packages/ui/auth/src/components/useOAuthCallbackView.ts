import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { BFFAuthService } from '~/services/BFFAuthService';
import { resolveAuthReturnUrl } from '~/services/resolveAuthReturnUrl';
import {
  AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS,
  startAuthCallbackNavigation,
} from '~/services/startAuthCallbackNavigation';

interface OAuthCallbackView {
  error: string | null;
  isProcessing: boolean;
}

export const useOAuthCallbackView = (): OAuthCallbackView => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const resolveCallbackTarget = useCallback(async () => {
    const authService = BFFAuthService.getInstance();
    const params = new URLSearchParams(window.location.search);

    await authService.handleCallback(params);

    const returnUrl = localStorage.getItem('auth_return_url');
    if (returnUrl === null) {
      throw new Error('Auth return URL is missing from localStorage');
    }
    return resolveAuthReturnUrl(returnUrl, {
      appBasePath: import.meta.env.BASE_URL,
      currentOrigin: window.location.origin,
      routerMode: window.location.hash.startsWith('#/') ? 'hash' : 'browser',
    });
  }, []);

  useEffect(() => {
    let active = true;
    let disposeNavigation: (() => void) | undefined;

    const processCallback = async (): Promise<void> => {
      try {
        const target = await resolveCallbackTarget();
        if (!active) return;

        const handle = startAuthCallbackNavigation({
          target,
          location: window.location,
          navigate: async (url) => {
            await navigate({ to: url, replace: true });
          },
          timeoutMs: AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS,
          onError: (navigationError) => {
            if (!active) return;
            console.error('OAuth callback navigation error:', navigationError);
            setError(navigationError.message);
            setIsProcessing(false);
          },
        });
        disposeNavigation = handle.dispose;
      } catch (callbackError) {
        if (!active) return;
        console.error('OAuth callback error:', callbackError);
        setError(callbackError instanceof Error ? callbackError.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    void processCallback();

    return () => {
      active = false;
      disposeNavigation?.();
    };
  }, [navigate, resolveCallbackTarget]);

  return { error, isProcessing };
};
