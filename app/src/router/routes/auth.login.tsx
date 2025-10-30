
/**
 * TurnstileOAuth2
 */
import { useState } from 'react';
import { Box, Container, Paper } from '@mui/material';
import { LoginForm, useAuth } from '@hierarchidb/ui-shell/ui-auth';
import { useLocation, } from '@tanstack/react-router';

export default function LoginRoute() {
  const location = useLocation();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Get the return URL from state or default to home
  const from = location.pathname || '/';

  const handleLogin = async (provider: string, _turnstileToken: string) => {
    try {
      setError(null);

      // Store return URL for after authentication
      sessionStorage.setItem('auth.returnUrl', from);

      // Initiate OAuth flow with Turnstile token
      // TODO: Add Turnstile token support to signIn
      await signIn({
        provider: provider as 'google',
        returnUrl: from,
        isUserInitiated: true,
      });

      // The OAuth flow will redirect to the provider
      // Control will not return here
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 3,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: '100%',
            p: 4,
          }}
        >
          <LoginForm onLogin={handleLogin} />

          {error && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
                borderRadius: 1,
              }}
            >
              {error}
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}
