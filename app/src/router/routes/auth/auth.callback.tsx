/**
 * OAuth2/OIDC
 */

import {
  BFFAuthService,
  resolveAuthReturnUrl as resolveSharedAuthReturnUrl,
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
  //const { handleCallback } = ;
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
    async function processCallback() {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        // If neither code nor error is present, assume a stray render and navigate away quietly.
        if (!code && !error) {
          const returnUrl = takeReturnUrl();
          const resolved = resolveReturnUrl(returnUrl);
          clearReturnUrl();
          if (resolved.isExternal) {
            window.location.assign(resolved.url);
            return;
          }
          try {
            if (resolved.url.startsWith('#/')) {
              const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
              window.location.replace(fullUrl);
            } else {
              await navigate({ to: resolved.url, replace: true });
            }
          } catch (navError) {
            console.error('[Auth Callback] Navigation failed (no code/error):', navError);
            if (resolved.url.startsWith('#/')) {
              const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
              window.location.replace(fullUrl);
            } else {
              window.location.replace(resolved.url);
            }
          }
          return;
        }

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          // Nothing to process; go home without throwing.
          const returnUrl = takeReturnUrl();
          const resolved = resolveReturnUrl(returnUrl);
          clearReturnUrl();
          if (resolved.isExternal) {
            window.location.assign(resolved.url);
            return;
          }
          try {
            if (resolved.url.startsWith('#/')) {
              const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
              window.location.replace(fullUrl);
            } else {
              await navigate({ to: resolved.url, replace: true });
            }
          } catch (navError) {
            console.error('[Auth Callback] Navigation failed (no code):', navError);
            if (resolved.url.startsWith('#/')) {
              const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
              window.location.replace(fullUrl);
            } else {
              window.location.replace(resolved.url);
            }
          }
          return;
        }

        const authService = BFFAuthService.getInstance();
        await authService.handleCallback(searchParams);

        const returnUrl = takeReturnUrl();
        const resolved = resolveReturnUrl(returnUrl);
        clearReturnUrl();

        console.debug('[Auth Callback] Navigation after successful authentication:', {
          returnUrl,
          resolved,
          isExternal: resolved.isExternal,
        });

        if (resolved.isExternal) {
          window.location.assign(resolved.url);
          return;
        }

        // Add debug logging for navigation attempt
        console.debug('[Auth Callback] Attempting navigation:', {
          url: resolved.url,
          urlLength: resolved.url.length,
          replace: true,
        });

        // Set up navigation timeout to prevent hanging
        const navigationTimeout = setTimeout(() => {
          console.warn('[Auth Callback] Navigation timeout, forcing redirect');
          if (resolved.url.startsWith('#/')) {
            // For hash routing, use window.location.replace with full URL
            const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
            window.location.replace(fullUrl);
          } else {
            window.location.replace(resolved.url);
          }
        }, 3000); // 3 second timeout

        try {
          // For hash routing, try direct hash assignment first
          if (resolved.url.startsWith('#/')) {
            console.debug('[Auth Callback] Using hash routing navigation');
            window.location.hash = resolved.url;

            // Wait a moment to see if navigation completes
            setTimeout(() => {
              if (window.location.hash === resolved.url) {
                console.debug('[Auth Callback] Hash navigation completed successfully');
                clearTimeout(navigationTimeout);
              } else {
                console.warn(
                  '[Auth Callback] Hash navigation may have failed, current hash:',
                  window.location.hash
                );
                // Let timeout handler take over
              }
            }, 500);
            return;
          }

          await navigate({ to: resolved.url, replace: true });
          console.debug('[Auth Callback] Navigation completed successfully');
          clearTimeout(navigationTimeout);
        } catch (navError) {
          console.error('[Auth Callback] Navigation failed:', {
            error: navError instanceof Error ? navError.message : String(navError),
            url: resolved.url,
          });

          // Clear timeout since we're handling the error immediately
          clearTimeout(navigationTimeout);

          // Fallback: use window.location for complex URLs
          console.debug('[Auth Callback] Falling back to window.location');
          if (resolved.url.startsWith('#/')) {
            // For hash routing, use full URL replacement to ensure navigation
            const fullUrl = `${window.location.origin}${window.location.pathname}${resolved.url}`;
            window.location.replace(fullUrl);
          } else {
            window.location.replace(resolved.url);
          }
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    processCallback();
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
