import { Alert, Box, Button, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import type { AuthProviderType } from '../types/AuthProviderType.js';

interface LoginFormProps {
  onLogin?: (provider: string, turnstileToken: string) => void;
  title?: string;
  subtitle?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  title = 'Sign In',
  subtitle = 'Choose your authentication provider',
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleProviderClick = async (provider: AuthProviderType) => {
    setError(null);
    setLoading(true);

    try {
      // For now, we'll use a dummy token since Turnstile integration may not be complete
      const turnstileToken = 'dummy-token';

      if (onLogin) {
        await onLogin(provider, turnstileToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {subtitle}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={() => handleProviderClick('google')}
          disabled={loading}
          sx={{ py: 1.5 }}
        >
          Sign in with Google
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={() => handleProviderClick('github')}
          disabled={loading}
          sx={{ py: 1.5 }}
        >
          Sign in with GitHub
        </Button>

        <Button
          variant="contained"
          fullWidth
          onClick={() => handleProviderClick('microsoft')}
          disabled={loading}
          sx={{ py: 1.5 }}
        >
          Sign in with Microsoft
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};
