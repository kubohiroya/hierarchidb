/**
 * OAuth2/OIDC
 */

import {
  AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS,
  BFFAuthService,
  resolveAuthReturnUrl as resolveSharedAuthReturnUrl,
  startAuthCallbackNavigation,
} from '@hierarchidb/ui-plugin-shell/ui-auth';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRouterMode } from '~/router/config';

export default function AuthCallbackRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = useMemo(() => {
    const searchString =
      location?.searchStr ?? (typeof window !== 'undefined' ? window.location.search : '');
    return new URLSearchParams(searchString ?? '');
  }, [location?.searchStr]);
  const [error, setError] = useState<string | null>(null);

  const resolveReturnUrl = useCallback((rawUrl: string) => {
    const routerMode = getRouterMode();
    const resolved = resolveSharedAuthReturnUrl(rawUrl, {
      appBasePath: import.meta.env.BASE_URL,
      currentOrigin: window.location.origin,
      routerMode,
    });

    console.debug('[Auth Callback] Return URL resolved:', {
      raw: rawUrl,
      routerMode,
      isExternal: resolved.isExternal,
      final: resolved.url,
    });

    return resolved;
  }, []);

  const returnUrlRef = useRef<string | null>(null);
  const takeReturnUrl = useCallback(() => {
    if (returnUrlRef.current) return returnUrlRef.current;
    const returnUrl = localStorage.getItem('auth_return_url');
    if (returnUrl === null) {
      throw new Error('Auth return URL is missing from localStorage');
    }
    returnUrlRef.current = returnUrl;

    // Debug logging for return URL retrieval
    console.debug('[Auth Callback] Return URL retrieved:', {
      stored: returnUrl,
      currentLocation: window.location.href,
      currentPathname: window.location.pathname,
      currentHash: window.location.hash,
    });

    return returnUrl;
  }, []);
  const clearReturnUrl = useCallback(() => {
    localStorage.removeItem('auth_return_url');
  }, []);

  useEffect(() => {
    let active = true;
    let disposeNavigation: (() => void) | undefined;

    async function processCallback() {
      try {
        const code = searchParams.get('code');
        const callbackError = searchParams.get('error');

        if (callbackError) {
          throw new Error(`Authentication error: ${callbackError}`);
        }

        if (code) {
          const authService = BFFAuthService.getInstance();
          await authService.handleCallback(searchParams);
        }

        if (!active) return;

        const returnUrl = takeReturnUrl();
        const resolved = resolveReturnUrl(returnUrl);
        clearReturnUrl();

        console.debug('[Auth Callback] Navigation after successful authentication:', {
          returnUrl,
          resolved,
          isExternal: resolved.isExternal,
        });

        const handle = startAuthCallbackNavigation({
          target: resolved,
          location: window.location,
          navigate: async (url) => {
            await navigate({ to: url, replace: true });
          },
          timeoutMs: AUTH_CALLBACK_NAVIGATION_TIMEOUT_MS,
          onError: (navigationError) => {
            if (!active) return;
            console.error('[Auth Callback] Navigation error:', navigationError);
            setError(navigationError.message);
          },
        });
        disposeNavigation = handle.dispose;
      } catch (callbackProcessingError) {
        if (!active) return;
        console.error('Auth callback error:', callbackProcessingError);
        setError(
          callbackProcessingError instanceof Error
            ? callbackProcessingError.message
            : 'Authentication failed'
        );
      }
    }

    void processCallback();

    return () => {
      active = false;
      disposeNavigation?.();
    };
  }, [searchParams, navigate, resolveReturnUrl, takeReturnUrl, clearReturnUrl]);

  useEffect(() => {
    if (window.opener) {
      const params = Object.fromEntries(searchParams.entries());
      window.opener.postMessage({ type: 'auth-callback', params }, window.location.origin);
      window.close();
    }
  }, [searchParams]);

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Typography>
          <a href="/">Return to Home</a>
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" sx={{ mt: 3 }}>
        Completing authentication...
      </Typography>
    </Box>
  );
}
