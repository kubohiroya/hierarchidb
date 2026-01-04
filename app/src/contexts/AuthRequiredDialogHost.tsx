import { useEffect, useRef, useState } from 'react';
import {
  AuthNotificationFactory,
  AuthNotificationRegistry,
  type AuthCancelledNotification,
  type AuthRequiredNotification,
  type AuthSuccessNotification,
} from '@hierarchidb/common-auth';
import { AuthRequiredDialog } from '@hierarchidb/ui-plugin-shell/ui-auth';

const HANDLER_ID = 'app-auth-required-dialog';

export function AuthRequiredDialogHost(): JSX.Element | null {
  const registry = AuthNotificationRegistry.getInstance();
  const [notification, setNotification] = useState<AuthRequiredNotification | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

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
            console.debug('[auth][ui] AUTH_SUCCESS received', { requestId: next.context.requestId });
          }
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
      onAuthCancelled: async (next: AuthCancelledNotification) => {
        if (activeRequestIdRef.current === next.context.requestId) {
          if (isAuthDebugEnabled()) {
            console.debug('[auth][ui] AUTH_CANCELLED received', { requestId: next.context.requestId, reason: next.context.reason });
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

  const handleSuccess = (token: string, expiresAt: number, userInfo?: {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
  }) => {
    const payload = userInfo?.id && userInfo?.email && userInfo?.name
      ? {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      }
      : undefined;
    const success = AuthNotificationFactory.createAuthSuccess({
      requestId: notification.context.requestId,
      newToken: token,
      expiresAt,
      sessionId: notification.context.sessionId,
      userInfo: payload,
    });
    void registry.dispatch(success);
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

    // Best-effort: when auth is declined during a multi-step plugin dialog,
    // guide the user back to Step2 (data source selection) instead of re-prompting.
    try {
      const current = new URL(window.location.href);
      const step = current.searchParams.get('step');
      if (step === '3') {
        current.searchParams.set('step', '2');
        window.history.replaceState(window.history.state, '', current.toString());
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch {
      // ignore
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
