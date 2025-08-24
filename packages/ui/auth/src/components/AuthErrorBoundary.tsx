import { Component, ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

// import { devError, devLog } from "@/shared/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Only catch authentication-related errors
    const isAuthError =
      error.message.includes('SimpleBFFAuthProvider') ||
      error.message.includes('auth') ||
      error.message.includes('authentication') ||
      error.message.includes('useAuthLib');

    if (isAuthError) {
      return { hasError: true, error };
    }

    // Re-throw non-auth errors to be handled by other error boundaries
    throw error;
  }

  componentDidCatch(error: Error) {
    //devError("Auth Error Boundary caught:", error, errorInfo);

    // During development, if it's an HMR-related error, try to recover
    if ((import.meta as any).hot && error.message.includes('SimpleBFFAuthProvider')) {
      // devLog("HMR-related auth error detected, attempting recovery...");
      // Give HMR time to update
      setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 1000);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // During HMR in development, show a simpler message
      if ((import.meta as any).hot && this.state.error?.message.includes('SimpleBFFAuthProvider')) {
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" gutterBottom>
              Updating authentication...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The app is refreshing due to code changes. This will resolve automatically.
            </Typography>
          </Box>
        );
      }

      // For other errors, show the full error UI
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Typography variant="h4" gutterBottom color="error">
            Authentication Error
          </Typography>
          <Typography variant="body1" paragraph>
            An error occurred with the authentication system.
          </Typography>
          {process.env.NODE_ENV === 'development' && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 3,
                fontFamily: 'monospace',
                bgcolor: 'grey.100',
                p: 2,
                borderRadius: 1,
                maxWidth: 600,
              }}
            >
              {this.state.error?.message}
            </Typography>
          )}
          <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.handleReload}>
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
