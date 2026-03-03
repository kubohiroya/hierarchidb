import { Alert, Box, Button, Typography } from '@mui/material';
import type React from 'react';
import { useLoginFormView } from './useLoginFormView.js';

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
  const { error, loading, handleProviderClick } = useLoginFormView({ onLogin });

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
