import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useBFFAuthService } from '~/hooks/useAuth';
import type { AuthProviderType } from '~/types/AuthProviderType';

export type AuthProvider = 'google' | 'github' | 'microsoft';

type AuthRequiredNotificationContext = {
  requestId: string;
  url: string;
  method?: string;
  errorCode: number;
  errorMessage: string;
  sessionId?: string;
  pluginType: string;
  retryCount?: number;
};

type AuthRequiredNotification = {
  type: 'AUTH_REQUIRED';
  source?: 'worker' | 'cors-proxy' | 'bff' | 'external-api';
  context: AuthRequiredNotificationContext;
  timestamp: number;
};

type AuthUserInfo = {
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

type UseAuthRequiredDialogParams = {
  open: boolean;
  notification: AuthRequiredNotification;
  onSuccess: (token: string, expiresAt: number, userInfo?: AuthUserInfo) => void;
  onCancel: () => void;
  onRetry?: () => void;
};

const isAuthDebugEnabled = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
  } catch {
    return false;
  }
};

export function useAuthRequiredDialog({
  open,
  notification,
  onSuccess,
  onCancel,
  onRetry,
}: UseAuthRequiredDialogParams) {
  const { context } = notification;
  const { errorMessage, pluginType, retryCount = 0, errorCode } = context;
  const bffAuth = useBFFAuthService();
  const { signIn, user, isAuthenticated } = bffAuth;

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);

  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  const currentUserPayload = useMemo(() => createUserPayload(user), [user]);
  const tokenExpiresAt = currentUserPayload?.expiresAt;
  const isTokenExpired = typeof tokenExpiresAt === 'number' && tokenExpiresAt <= Date.now();
  const shouldAutoResolve = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (isTokenExpired) return false;
    if (!errorMessage) return false;
    return /missing bearer token/i.test(errorMessage);
  }, [errorMessage, isAuthenticated, isTokenExpired, user]);

  const authStatusMessage = useMemo(() => {
    if (!isAuthenticated || !user) return null;
    if (isTokenExpired) {
      return 'Your current session has expired. Please sign in again to continue.';
    }
    if (errorCode === 401) {
      return 'Your current session token was rejected (HTTP 401). It may be revoked or invalid.';
    }
    return null;
  }, [errorCode, isAuthenticated, isTokenExpired, user]);

  useEffect(() => {
    if (open) {
      setAuthError(null);
      setSelectedProvider(null);

      if (isAuthDebugEnabled()) {
        const details = {
          requestId: context.requestId,
          pluginType,
          retryCount,
          errorCode,
          errorMessage,
          url: context.url,
          ...(context.sessionId ? { sessionId: context.sessionId } : {}),
        };
        console.debug('[auth][ui] Authentication required details', details);
      }
    }
  }, [context.requestId, context.sessionId, context.url, errorCode, errorMessage, open, pluginType, retryCount]);

  useEffect(() => {
    if (!open || !shouldAutoResolve) return;
    const payload = createUserPayload(user) ?? currentUserPayload;
    if (!payload) return;
    onSuccess(payload.token, payload.expiresAt, payload.info);
  }, [currentUserPayload, onSuccess, open, shouldAutoResolve, user]);

  const handleSignIn = useCallback(
    async (provider: AuthProvider) => {
      setIsAuthenticating(true);
      setSelectedProvider(provider);
      setAuthError(null);

      try {
        console.log(`🔐 Starting ${provider} authentication for batch processing`);
        await signIn({
          provider: provider as AuthProviderType,
          returnUrl: typeof window !== 'undefined' ? window.location.href : '/',
          method: 'redirect',
        });

        const payload = createUserPayload(bffAuth.user) ?? currentUserPayload ?? null;
        if (!payload) return;

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
    console.log('🚫 User cancelled authentication for build processing');
    onCancel();
  }, [onCancel]);

  const handleRetry = useCallback(() => {
    if (onRetry) {
      console.log('🔄 Retrying request without authentication');
      onRetry();
    }
  }, [onRetry]);

  const getErrorSeverity = () => {
    if (errorCode >= 500) return 'error';
    if (errorCode === 401) return 'warning';
    return 'info';
  };

  const isMicrosoftProviderDisabled = (provider: AuthProvider) => provider === 'microsoft';

  return {
    context,
    dialogTitleId,
    dialogDescriptionId,
    isAuthenticating,
    authError,
    selectedProvider,
    retryCount,
    authStatusMessage,
    isAuthenticated,
    handleSignIn,
    handleCancel,
    handleRetry,
    getErrorSeverity,
    isMicrosoftProviderDisabled,
    user: user ?? null,
  };
}
