/**
 * @file AuthRequiredDialog.tsx
 * @description Authentication required base-dialog for build processing interruption
 *
 * This base-dialog is shown when build processing encounters authentication errors
 * and needs user intervention to continue.
 */

import {
  Close as CloseIcon,
  GitHub as GitHubIcon,
  Google as GoogleIcon,
  Lock as LockIcon,
  Microsoft as MicrosoftIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useAuthRequiredDialog, type AuthProvider } from '../hooks/useAuthRequiredDialog';

// Local minimal type to avoid workspace linking issues during typecheck.
// Aligns with @hierarchidb/_obsolate_common-auth AuthRequiredNotification shape used here.
type AuthRequiredNotification = {
  type: 'AUTH_REQUIRED';
  source?: 'worker' | 'cors-proxy' | 'bff' | 'external-api';
  context: {
    requestId: string;
    url: string;
    method?: string;
    errorCode: number;
    errorMessage: string;
    sessionId?: string;
    pluginType: string;
    retryCount?: number;
  };
  timestamp: number;
};

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
  onSuccess: (token: string, expiresAt: number, userInfo?: AuthUserInfo) => void;
  /** Callback when user cancels authentication */
  onCancel: () => void;
  /** Callback to retry without authentication (if applicable) */
  onRetry?: () => void;
  /** Whether to show session details */
  showSessionDetails?: boolean;
  /** Override label for the cancel button */
  cancelLabel?: string;
}

export type AuthUserInfo = {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
};

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
  cancelLabel,
}: AuthRequiredDialogProps) {
  const {
    dialogTitleId,
    dialogDescriptionId,
    isAuthenticating,
    authError,
    authStatusMessage,
    isAuthenticated,
    user,
    selectedProvider,
    retryCount,
    context,
    handleSignIn,
    handleCancel,
    handleRetry,
    getErrorSeverity,
    isMicrosoftProviderDisabled,
  } = useAuthRequiredDialog({
    open,
    notification,
    onSuccess,
    onCancel,
    onRetry,
  });

  const { sessionId, pluginType } = context;

  const getProviderButton = (provider: AuthProvider) => {
    const info = AUTH_PROVIDERS[provider];
    const Icon = info.icon;
    const isSelected = selectedProvider === provider;
    const isDisabled = isMicrosoftProviderDisabled(provider) || (isAuthenticating && !isSelected);

    return (
      <Button
        key={provider}
        variant="contained"
        color="secondary"
        size="large"
        startIcon={
          isSelected && isAuthenticating ? <CircularProgress size={20} color="inherit" /> : <Icon />
        }
        onClick={() => handleSignIn(provider)}
        disabled={isDisabled}
        sx={{
          minWidth: 220,
          height: 52,
          px: 2,
          justifyContent: 'center',
          textTransform: 'none',
          fontWeight: 700,
          '&:disabled': { opacity: 0.5 },
        }}
      >
        {isSelected && isAuthenticating ? 'Signing in...' : info.name}
      </Button>
    );
  };

  const cancelButtonLabel = cancelLabel ?? 'Cancel';

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isAuthenticating}
      sx={{
        // Ensure auth prompt stays above plugin dialogs / overlays.
        zIndex: (theme) => theme.zIndex.modal + 200,
      }}
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
    >
      <DialogTitle id={dialogTitleId}>
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

      <DialogContent id={dialogDescriptionId}>
        {/* Main Alert */}
        <Alert severity={getErrorSeverity()} icon={false} sx={{ mb: 3 }}>
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
                <strong>Build Session:</strong> {sessionId.slice(-12)}
              </Typography>
              <Typography variant="body2">
                <strong>Plugin:</strong> {pluginType.charAt(0).toUpperCase() + pluginType.slice(1)}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Authentication Error */}
        {authError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {authError}
          </Alert>
        )}

        {authStatusMessage && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {authStatusMessage}
          </Alert>
        )}
        {/* Current Session */}
        {isAuthenticated && user && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2">
              You are currently signed in as <strong>{user.name || user.email}</strong>
            </Typography>
          </Alert>
        )}

        {/* Authentication Options */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Sign in to continue processing:
          </Typography>

          <Box
            display="flex"
            gap={2}
            flexWrap="wrap"
            alignItems="center"
            justifyContent="center"
            sx={{ mt: 2 }}
          >
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
              size="large"
              sx={{
                minWidth: 240,
                height: 52,
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {cancelButtonLabel}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
