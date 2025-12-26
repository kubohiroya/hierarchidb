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

  useEffect(() => {
    registry.register(HANDLER_ID, {
      onAuthRequired: async (next: AuthRequiredNotification) => {
        activeRequestIdRef.current = next.context.requestId;
        setNotification(next);
      },
      onAuthSuccess: async (next: AuthSuccessNotification) => {
        if (activeRequestIdRef.current === next.context.requestId) {
          activeRequestIdRef.current = null;
          setNotification(null);
        }
      },
      onAuthCancelled: async (next: AuthCancelledNotification) => {
        if (activeRequestIdRef.current === next.context.requestId) {
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
  };

  return (
    <AuthRequiredDialog
      open
      notification={notification}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  );
}
