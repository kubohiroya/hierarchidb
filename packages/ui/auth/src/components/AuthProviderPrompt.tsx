import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { AuthProviderType } from '../types/AuthProviderType';
import { AuthProviderOptions } from './AuthProviderOptions';

interface AuthProviderPromptProps {
  isLoadingAuth: boolean;
  onSignIn: (provider?: AuthProviderType) => void;
  title?: string;
  subtitle?: string;
}

/**
 * Inline version of auth provider selection
 */
export const AuthProviderPrompt: React.FC<AuthProviderPromptProps> = ({
  isLoadingAuth,
  onSignIn,
  title = 'Authentication Required',
  subtitle = 'Please sign in to continue',
}) => {
  const handleSignIn = (provider: AuthProviderType) => {
    onSignIn(provider);
  };

  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {subtitle}
      </Typography>

      <Stack spacing={2} sx={{ maxWidth: 300, mx: 'auto' }}>
        {AuthProviderOptions.filter((provider) => provider.available).map((provider) => (
          <Button
            key={provider.type}
            variant="contained"
            onClick={() => handleSignIn(provider.type)}
            disabled={isLoadingAuth}
            startIcon={provider.icon}
            fullWidth
            sx={{
              backgroundColor: provider.color,
              '&:hover': {
                backgroundColor: provider.color,
                filter: 'brightness(0.9)',
              },
            }}
          >
            Sign in with {provider.name}
          </Button>
        ))}
      </Stack>
    </Box>
  );
};

// Re-export for backward compatibility
export { AuthProviderPrompt as AuthRequiredPrompt };
