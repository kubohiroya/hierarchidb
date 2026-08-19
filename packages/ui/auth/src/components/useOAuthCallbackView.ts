import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { BFFAuthService } from '~/services/BFFAuthService';
import { resolveAuthReturnUrl } from '~/services/resolveAuthReturnUrl';

interface OAuthCallbackView {
  error: string | null;
  isProcessing: boolean;
}

export const useOAuthCallbackView = (): OAuthCallbackView => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const handleCallback = useCallback(async () => {
    try {
      const authService = BFFAuthService.getInstance();
      const params = new URLSearchParams(window.location.search);

      await authService.handleCallback(params);

      const returnUrl = localStorage.getItem('auth_return_url');
      if (returnUrl === null) {
        throw new Error('Auth return URL is missing from localStorage');
      }
      const resolved = resolveAuthReturnUrl(returnUrl, {
        appBasePath: import.meta.env.BASE_URL,
        currentOrigin: window.location.origin,
        routerMode: window.location.hash.startsWith('#/') ? 'hash' : 'browser',
      });

      if (resolved.isExternal) {
        window.location.assign(resolved.url);
        return;
      }

      if (resolved.url.startsWith('#/')) {
        window.location.replace(
          `${window.location.origin}${window.location.pathname}${resolved.url}`
        );
        return;
      }

      await navigate({ to: resolved.url, replace: true });
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setIsProcessing(false);
    }
  }, [navigate]);

  useEffect(() => {
    void handleCallback();
  }, [handleCallback]);

  return { error, isProcessing };
};
