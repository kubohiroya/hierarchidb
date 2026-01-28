/**
 * OAuth2/OIDC
 */

import { BFFAuthService } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

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

  const getAppBasePrefix = () => {
    const base = import.meta.env.BASE_URL || '/';
    const normalized = String(base).startsWith('/') ? String(base) : `/${String(base)}`;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  };

  const normalizeHashReturnPath = (pathname: string) => {
    const basePrefix = getAppBasePrefix();
    if (!basePrefix || basePrefix === '/') return pathname;
    if (pathname === basePrefix) return '/';
    if (pathname.startsWith(`${basePrefix}/`)) {
      const stripped = pathname.slice(basePrefix.length);
      return stripped.length > 0 ? stripped : '/';
    }
    return pathname;
  };

  const resolveReturnUrl = (rawUrl: string) => {
    try {
      const resolved = new URL(rawUrl, window.location.origin);
      if (resolved.origin !== window.location.origin) {
        return { isExternal: true, url: resolved.toString() };
      }
      const usesHashRouting = window.location.hash.startsWith('#/');
      const normalizedPath = usesHashRouting
        ? normalizeHashReturnPath(resolved.pathname)
        : resolved.pathname;
      return { isExternal: false, url: `${normalizedPath}${resolved.search}${resolved.hash}` };
    } catch {
      return { isExternal: false, url: '/' };
    }
  };

  useEffect(() => {
    async function processCallback() {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        // If neither code nor error is present, assume a stray render and navigate away quietly.
        if (!code && !error) {
          const returnUrl = localStorage.getItem('auth_return_url') || '/';
          const resolved = resolveReturnUrl(returnUrl);
          if (resolved.isExternal) {
            window.location.assign(resolved.url);
            return;
          }
          navigate({ to: resolved.url, replace: true });
          return;
        }

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          // Nothing to process; go home without throwing.
          const returnUrl = localStorage.getItem('auth_return_url') || '/';
          const resolved = resolveReturnUrl(returnUrl);
          if (resolved.isExternal) {
            window.location.assign(resolved.url);
            return;
          }
          navigate({ to: resolved.url, replace: true });
          return;
        }

        const authService = BFFAuthService.getInstance();
        await authService.handleCallback(searchParams);

        const returnUrl = localStorage.getItem('auth_return_url') || '/';
        const resolved = resolveReturnUrl(returnUrl);
        if (resolved.isExternal) {
          window.location.assign(resolved.url);
          return;
        }
        navigate({ to: resolved.url, replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    processCallback();
  }, [searchParams, navigate]);

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
