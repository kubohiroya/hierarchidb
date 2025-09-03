/**
 * @file AuthRequiredDialog.tsx
 * @description Authentication required base-dialog for batch processing interruption
 *
 * This base-dialog is shown when batch processing encounters authentication errors
 * and needs user intervention to continue.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Lock as LockIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Google as GoogleIcon,
  GitHub as GitHubIcon,
  Microsoft as MicrosoftIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { AuthProviderType } from '../types/AuthProviderType';
import type { AuthRequiredNotification } from '@hierarchidb/common-auth';

export interface AuthRequiredDialogProps {
  /** Whether the base-dialog is open */
  open: boolean;
  /** Dialog title */
  title?: string;
  /** Main message to display */
  message?: string;
  /** Authentication notification with context details */
  notification: AuthRequiredNotification;
  /** Callback when authentication succeeds */
  onSuccess: (token: string, expiresAt: number, userInfo?: any) => void;
  /** Callback when user cancels authentication */
  onCancel: () => void;
  /** Callback to retry without authentication (if applicable) */
  onRetry?: () => void;
  /** Whether to show session details */
  showSessionDetails?: boolean;
}

type AuthProvider = 'google' | 'github' | 'microsoft';

interface AuthProviderInfo {
  name: string;
  icon: React.ComponentType;
  color: string;
  description: string;
}

const AUTH_PROVIDERS: Record<AuthProvider, AuthProviderInfo> = {
  google: {
    name: 'Google',
    icon: GoogleIcon,
    color: '#4285f4',
    description: 'Sign in with your Google account',
  },
  github: {
    name: 'GitHub',
    icon: GitHubIcon,
    color: '#333',
    description: 'Sign in with your GitHub account',
  },
  microsoft: {
    name: 'Microsoft',
    icon: MicrosoftIcon,
    color: '#0078d4',
    description: 'Sign in with your Microsoft account',
  },
};

export function AuthRequiredDialog({
  open,
  title = 'Authentication Required',
  message,
  notification,
  onSuccess,
  onCancel,
  onRetry,
  showSessionDetails = true,
}: AuthRequiredDialogProps) {
  const { signIn, user, isAuthenticated } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);

  const { context } = notification;
  const { url, errorMessage, sessionId, pluginType, retryCount = 0, errorCode } = context;

  // Clear error when base-dialog opens/closes
  useEffect(() => {
    if (open) {
      setAuthError(null);
      setSelectedProvider(null);
    }
  }, [open]);

  // Auto-use current session if already authenticated
  useEffect(() => {
    if (isAuthenticated && user && !isAuthenticating) {
      handleUseCurrentSession();
    }
  }, [isAuthenticated, user, isAuthenticating]);

  const handleSignIn = useCallback(
    async (provider: AuthProvider) => {
      setIsAuthenticating(true);
      setSelectedProvider(provider);
      setAuthError(null);

      try {
        console.log(`🔐 Starting ${provider} authentication for batch processing`);

        await signIn({
          provider: provider as AuthProviderType,
          // Context is not part of BFFSignInOptions, so we remove it
        });

        // After successful signIn, use the user from useAuth
        if (user) {
          console.log(`✅ Authentication successful with ${provider}`);
          onSuccess(user.access_token, user.expires_at, {
            id: user.profile.sub,
            email: user.profile.email,
            name: user.profile.name,
            picture: user.profile.picture,
          });
        } else {
          throw new Error('Authentication failed');
        }
      } catch (error) {
        console.error(`❌ Authentication failed with ${provider}:`, error);
        setAuthError(
          error instanceof Error ? error.message : 'Authentication failed. Please try again.'
        );
      } finally {
        setIsAuthenticating(false);
        setSelectedProvider(null);
      }
    },
    [signIn, onSuccess, sessionId, pluginType, context.requestId]
  );

  const handleUseCurrentSession = useCallback(() => {
    if (user) {
      console.log('✅ Using current authentication session for batch processing');
      onSuccess(user.access_token, user.expires_at, {
        id: user.profile.sub,
        email: user.profile.email,
        name: user.profile.name,
        picture: user.profile.picture,
      });
    }
  }, [user, onSuccess]);

  const handleCancel = useCallback(() => {
    const hasSession = Boolean(sessionId);
    const confirmMessage = hasSession
      ? 'Canceling authentication will stop the batch processing session. Are you sure?'
      : 'Are you sure you want to cancel?';

    const confirmed = window.confirm(confirmMessage);
    if (confirmed) {
      console.log('🚫 User cancelled authentication for batch processing');
      onCancel();
    }
  }, [sessionId, onCancel]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      console.log('🔄 Retrying request without authentication');
      onRetry();
    }
  }, [onRetry]);

  const getErrorSeverity = (): 'error' | 'warning' | 'info' => {
    if (errorCode >= 500) return 'error';
    if (errorCode === 401) return 'warning';
    return 'info';
  };

  const getProviderButton = (provider: AuthProvider) => {
    const info = AUTH_PROVIDERS[provider];
    const Icon = info.icon;
    const isSelected = selectedProvider === provider;
    const isDisabled = isAuthenticating && !isSelected;

    return (
      <Button
        key={provider}
        variant={isSelected ? 'contained' : 'outlined'}
        size="large"
        startIcon={
          isSelected && isAuthenticating ? (
            <Box sx={{ width: 20, height: 20 }}>
              <LinearProgress
                variant="indeterminate"
                sx={{
                  borderRadius: 1,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: 'white',
                  },
                }}
              />
            </Box>
          ) : (
            <Icon />
          )
        }
        onClick={() => handleSignIn(provider)}
        disabled={isDisabled}
        sx={{
          minWidth: 200,
          justifyContent: 'flex-start',
          borderColor: info.color,
          color: isSelected ? 'white' : info.color,
          backgroundColor: isSelected ? info.color : 'transparent',
          '&:hover': {
            backgroundColor: isSelected ? info.color : `${info.color}10`,
            borderColor: info.color,
          },
          '&:disabled': {
            opacity: 0.5,
          },
        }}
      >
        {isSelected && isAuthenticating ? 'Signing in...' : info.name}
      </Button>
    );
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isAuthenticating}
      aria-labelledby="auth-required-dialog-title"
    >
      <DialogTitle id="auth-required-dialog-title">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <LockIcon color="warning" />
            <Typography variant="h6" component="div">
              {title}
            </Typography>
          </Box>

          <IconButton
            onClick={handleCancel}
            disabled={isAuthenticating}
            size="small"
            aria-label="Close dialog"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Main Alert */}
        <Alert severity={getErrorSeverity()} icon={<LockIcon />} sx={{ mb: 3 }}>
          <Typography variant="body1">
            {message ||
              `The ${pluginType} plugin requires authentication to continue batch processing.`}
          </Typography>
          {retryCount > 0 && (
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
              This is attempt #{retryCount + 1} to resolve the authentication issue.
            </Typography>
          )}
        </Alert>

        {/* Session Information */}
        {showSessionDetails && sessionId && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Batch Processing Session:</strong> {sessionId.slice(-12)}
              </Typography>
              <Typography variant="body2">
                <strong>Plugin:</strong> {pluginType.charAt(0).toUpperCase() + pluginType.slice(1)}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Error Details */}
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="error-details-content">
            <Typography variant="subtitle2" display="flex" alignItems="center" gap={1}>
              <InfoIcon fontSize="small" />
              Technical Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <ErrorIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Error Code" secondary={errorCode} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <WarningIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Error Message" secondary={errorMessage} />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Request URL"
                  secondary={
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {url}
                    </Typography>
                  }
                />
              </ListItem>
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Authentication Error */}
        {authError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {authError}
          </Alert>
        )}

        {/* Current Session */}
        {isAuthenticated && user && (
          <Alert
            severity="success"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={handleUseCurrentSession}
                disabled={isAuthenticating}
                startIcon={<CheckCircleIcon />}
              >
                Use Current Session
              </Button>
            }
            sx={{ mb: 3 }}
          >
            <Typography variant="body2">
              You are currently signed in as{' '}
              <strong>{user.profile.name || user.profile.email}</strong>
            </Typography>
          </Alert>
        )}

        {/* Authentication Options */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Sign in to continue processing:
          </Typography>

          <Box display="flex" flexDirection="column" gap={2} alignItems="stretch" sx={{ mt: 2 }}>
            {(Object.keys(AUTH_PROVIDERS) as AuthProvider[]).map(getProviderButton)}
          </Box>
        </Box>

        {/* Help Text */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Authentication is required to access external APIs securely. Your session will be used
          only for this batch processing operation.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Box display="flex" justifyContent="space-between" width="100%">
          <Box>
            {onRetry && (
              <Button
                onClick={handleRetry}
                disabled={isAuthenticating}
                startIcon={<PlayIcon />}
                color="info"
              >
                Retry Without Auth
              </Button>
            )}
          </Box>

          <Box display="flex" gap={1}>
            <Button
              onClick={handleCancel}
              disabled={isAuthenticating}
              startIcon={<StopIcon />}
              color="error"
              variant="outlined"
            >
              {sessionId ? 'Cancel Processing' : 'Cancel'}
            </Button>

            {isAuthenticated && user && (
              <Button
                variant="contained"
                onClick={handleUseCurrentSession}
                disabled={isAuthenticating}
                startIcon={<CheckCircleIcon />}
              >
                Continue with Current Session
              </Button>
            )}
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default AuthRequiredDialog;
