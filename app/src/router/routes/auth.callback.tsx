/**
 * OAuth2/OIDC
 */

import { BFFAuthService } from '@hierarchidb/ui-shell/ui-auth';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function processCallback() {
      try {
        //  URL
        const code = searchParams.get('code');
        //const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        const authService = BFFAuthService.getInstance();
        await authService.handleCallback(searchParams);

        const returnUrl = localStorage.getItem('auth_return_url') || '/';
        localStorage.removeItem('auth_return_url');
        navigate({ to: returnUrl, replace: true });
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
