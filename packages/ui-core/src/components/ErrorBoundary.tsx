import React, { Component, ReactNode } from 'react';
import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * General-purpose error boundary for catching application errors
 * that are not specifically authentication-related
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Catch all application errors
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
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
            Application Error
          </Typography>
          <Typography variant="body1" paragraph>
            An unexpected error occurred. Please try reloading the page.
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
