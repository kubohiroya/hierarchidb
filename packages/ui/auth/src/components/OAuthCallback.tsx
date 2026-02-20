/**
 * @file OAuthCallback.tsx
 * @description OAuth callback handler component for BFF authentication
 * Processes OAuth callbacks and exchanges authorization codes for tokens
 */

import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { BFFAuthService } from '~/services/BFFAuthService';

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  const getAppBasePrefix = useCallback(() => {
    const base = import.meta.env.BASE_URL || '/';
    const normalized = String(base).startsWith('/') ? String(base) : `/${String(base)}`;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  }, []);

  const normalizeHashReturnPath = useCallback((pathname: string) => {
    const basePrefix = getAppBasePrefix();
    if (!basePrefix || basePrefix === '/') return pathname;
    if (pathname === basePrefix) return '/';
    if (pathname.startsWith(`${basePrefix}/`)) {
      const stripped = pathname.slice(basePrefix.length);
      return stripped.length > 0 ? stripped : '/';
    }
    return pathname;
  }, [getAppBasePrefix]);

  const resolveReturnUrl = useCallback((rawUrl: string) => {
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
  }, [normalizeHashReturnPath]);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const authService = BFFAuthService.getInstance();
        const params = new URLSearchParams(window.location.search);

        // Handle OAuth callback
        await authService.handleCallback(params);

        // Get return URL from storage
        const returnUrl = localStorage.getItem('auth_return_url') || '/';

        // Navigate to the return URL
        const resolved = resolveReturnUrl(returnUrl);
        if (resolved.isExternal) {
          window.location.assign(resolved.url);
          return;
        }
        void navigate({ to: resolved.url, replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [navigate, resolveReturnUrl]);

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
        <Typography variant="body2" color="text.secondary">
          <a href="/" style={{ color: 'inherit' }}>
            Return to home
          </a>
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
      <CircularProgress size={48} sx={{ mb: 2 }} />
      <Typography variant="h6" color="text.secondary">
        {isProcessing ? 'Completing authentication...' : 'Redirecting...'}
      </Typography>
    </Box>
  );
};
