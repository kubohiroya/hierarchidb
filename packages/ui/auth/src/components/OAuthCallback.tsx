/**
 * @file OAuthCallback.tsx
 * @description OAuth callback handler component for BFF authentication
 * Processes OAuth callbacks and exchanges authorization codes for tokens
 */

import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import { BFFAuthService } from '../services/BFFAuthService.js';

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const authService = BFFAuthService.getInstance();
        const params = new URLSearchParams(window.location.search);

        // Handle OAuth callback
        await authService.handleCallback(params);

        // Get return URL from storage
        const returnUrl = localStorage.getItem('auth_return_url') || '/';
        localStorage.removeItem('auth_return_url');

        // Navigate to the return URL
        void navigate({ to: returnUrl, replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [navigate]);

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
