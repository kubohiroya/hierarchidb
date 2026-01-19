import {
  type AuthCancelledNotification,
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
} from '@hierarchidb/common-auth';
import { useDialogUrlSync } from '@hierarchidb/plugin-base';
import { AuthRequiredDialog } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { useEffect, useRef, useState } from 'react';

const HANDLER_ID = 'app-auth-required-dialog';

export function AuthRequiredDialogHost(): JSX.Element | null {
  const registry = AuthNotificationRegistry.getInstance();
  const [notification, setNotification] = useState<AuthRequiredNotification | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const { setStep } = useDialogUrlSync();

  const isAuthDebugEnabled = () => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
    } catch {
      return false;
    }
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

  if (!notification) return null;

  const handleSuccess = (
    _token: string,
    _expiresAt: number,
    _userInfo?: {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    }
  ) => {
    activeRequestIdRef.current = null;
    setNotification(null);
  };

  const handleCancel = () => {
    const cancelled = AuthNotificationFactory.createAuthCancelled({
      requestId: notification.context.requestId,
      sessionId: notification.context.sessionId,
      reason: 'user-cancelled',
    });
    void registry.dispatch(cancelled);
    activeRequestIdRef.current = null;
    setNotification(null);

    if (notification.context.pluginType === 'shape') {
      setStep(2);
    }
  };

  return (
    <AuthRequiredDialog
      open
      notification={notification}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
      cancelLabel={
        notification.context.pluginType === 'shape' ? 'Cancel (Back to Step 2)' : undefined
      }
    />
  );
}
