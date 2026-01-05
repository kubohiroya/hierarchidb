/**
 * @file AuthRequiredDialog.tsx
 * @description Authentication required base-dialog for batch processing interruption
 *
 * This base-dialog is shown when batch processing encounters authentication errors
 * and needs user intervention to continue.
 */

import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  GitHub as GitHubIcon,
  Google as GoogleIcon,
  Lock as LockIcon,
  Microsoft as MicrosoftIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useBFFAuthService } from '../hooks/useAuth.js';
import type { AuthProviderType } from '../types/AuthProviderType.js';

// Local minimal type to avoid workspace linking issues during typecheck.
// Aligns with @hierarchidb/_obsolate_common-auth AuthRequiredNotification shape used here.
type AuthRequiredNotification = {
  type: 'AUTH_REQUIRED';
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

type AuthProvider = 'google' | 'github' | 'microsoft';

export type AuthUserInfo = {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type AuthUserPayload = {
  token: string;
  expiresAt: number;
  info: AuthUserInfo;
};

const createUserPayload = (
  authUser: ReturnType<typeof useBFFAuthService>['user']
): AuthUserPayload | null => {
  if (!authUser?.access_token || !authUser.expires_at) {
    return null;
  }

  return {
    token: authUser.access_token,
    expiresAt: authUser.expires_at,
    info: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      picture: authUser.picture,
    },
  };
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
  const bffAuth = useBFFAuthService();
  const { signIn, user, isAuthenticated } = bffAuth;
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);

  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  const { context } = notification;
  const { url, errorMessage, sessionId, pluginType, retryCount = 0, errorCode } = context;

  const currentUserPayload = useMemo(() => createUserPayload(user), [user]);

  const handleUseCurrentSession = useCallback(() => {
    if (currentUserPayload) {
      console.log('✅ Using current authentication session for batch processing');
      onSuccess(currentUserPayload.token, currentUserPayload.expiresAt, currentUserPayload.info);
    }
  }, [currentUserPayload, onSuccess]);

  // Clear error when base-dialog opens/closes
  useEffect(() => {
    if (open) {
      setAuthError(null);
      setSelectedProvider(null);

      // Keep the UI compact. Log technical details to console instead of rendering them.
      const details = {
        requestId: context.requestId,
        pluginType,
        retryCount,
        errorCode,
        errorMessage,
        url,
        ...(sessionId ? { sessionId } : {}),
      };
      console.warn('[auth][ui] Authentication required details', details);
    }
  }, [context.requestId, errorCode, errorMessage, open, pluginType, retryCount, sessionId, url]);

  // Auto-use current session if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentUserPayload && !isAuthenticating) {
      handleUseCurrentSession();
    }
  }, [currentUserPayload, handleUseCurrentSession, isAuthenticated, isAuthenticating]);

  const handleSignIn = useCallback(
    async (provider: AuthProvider) => {
      setIsAuthenticating(true);
      setSelectedProvider(provider);
      setAuthError(null);

      try {
        console.log(`🔐 Starting ${provider} authentication for batch processing`);

        // Routerに依存しない: その場のURLへ戻れれば十分
        await signIn({
          provider: provider as AuthProviderType,
          returnUrl: typeof window !== 'undefined' ? window.location.href : '/',
          method: 'redirect',
        });

        const payload = createUserPayload(bffAuth.user) ?? currentUserPayload ?? null;

        if (!payload) {
          throw new Error('Authentication failed');
        }

        console.log(`✅ Authentication successful with ${provider}`);
        onSuccess(payload.token, payload.expiresAt, payload.info);
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
    [bffAuth.user, currentUserPayload, onSuccess, signIn]
  );

  const handleCancel = useCallback(() => {
    if (cancelLabel) {
      console.log('🚫 User cancelled authentication for batch processing');
      onCancel();
      return;
    }

    const hasSession = Boolean(sessionId);
    const confirmMessage = hasSession
      ? 'Canceling authentication will stop the batch processing session. Are you sure?'
      : 'Are you sure you want to cancel?';

    const confirmed = window.confirm(confirmMessage);
    if (confirmed) {
      console.log('🚫 User cancelled authentication for batch processing');
      onCancel();
    }
  }, [cancelLabel, sessionId, onCancel]);

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
    const isMicrosoft = provider === 'microsoft';
    const isDisabled = isMicrosoft || (isAuthenticating && !isSelected);

    return (
      <Button
        key={provider}
        variant="contained"
        color="secondary"
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

  const cancelButtonLabel = cancelLabel ?? (sessionId ? 'Cancel Processing' : 'Cancel');

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
        <Alert severity={getErrorSeverity()} icon={<WarningIcon />} sx={{ mb: 3 }}>
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
              <strong>{user.name || user.email}</strong>
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
