/**
 * @file OAuthCallback.tsx
 * @description OAuth callback handler component for BFF authentication
 * Processes OAuth callbacks and exchanges authorization codes for tokens
 */

import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import type React from 'react';
import { useOAuthCallbackView } from './useOAuthCallbackView.js';

export const OAuthCallback: React.FC = () => {
  const { error, isProcessing } = useOAuthCallbackView();

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
