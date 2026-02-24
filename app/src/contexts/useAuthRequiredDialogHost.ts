import {
  type AuthCancelledNotification,
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
} from '@hierarchidb/auth';
import { useEffect, useRef, useState } from 'react';

const HANDLER_ID = 'app-auth-required-dialog';

export type AuthRequiredDialogHostState = {
  notification: AuthRequiredNotification | null;
  handleSuccess: () => void;
  handleCancel: () => void;
};

const isAuthDebugEnabled = () => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
  } catch {
    return false;
  }
};

export function useAuthRequiredDialogHost(): AuthRequiredDialogHostState {
  const registry = AuthNotificationRegistry.getInstance();
  const [notification, setNotification] = useState<AuthRequiredNotification | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  const handleSuccess = () => {
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  const handleCancel = () => {
    if (!notification) {
      return;
    }

    const cancelled = AuthNotificationFactory.createAuthCancelled({
      requestId: notification.context.requestId,
      sessionId: notification.context.sessionId,
      reason: 'user-cancelled',
    });
    void registry.dispatch(cancelled);
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  useEffect(() => {
    registry.register(HANDLER_ID, {
      onAuthRequired: async (next: AuthRequiredNotification) => {
        if (isAuthDebugEnabled()) {
          console.debug('[auth][ui] AUTH_REQUIRED received', {
            requestId: next.context.requestId,
            pluginType: next.context.pluginType,
            url: next.context.url,
          });
        }
        activeRequestIdRef.current = next.context.requestId;
        setNotification(next);
      },
      onAuthSuccess: async (next: AuthSuccessNotification) => {
        if (activeRequestIdRef.current === next.context.requestId) {
          if (isAuthDebugEnabled()) {
            console.debug('[auth][ui] AUTH_SUCCESS received', {
              requestId: next.context.requestId,
            });
          }
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
      onAuthCancelled: async (next: AuthCancelledNotification) => {
        if (activeRequestIdRef.current === next.context.requestId) {
          if (isAuthDebugEnabled()) {
            console.debug('[auth][ui] AUTH_CANCELLED received', {
              requestId: next.context.requestId,
              reason: next.context.reason,
            });
          }
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
    });

    return () => {
      registry.unregister(HANDLER_ID);
    };
  }, [registry]);

  return {
    notification,
    handleSuccess,
    handleCancel,
  };
}
